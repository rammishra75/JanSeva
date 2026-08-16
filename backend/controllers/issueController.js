import fs from 'fs';
import sharp from 'sharp';
import Issue from '../models/Issue.js';
import IssueCluster from '../models/IssueCluster.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { findDuplicates, mergeIntoCluster, prepareIssueFingerprints, userAlreadyReported, findSameUserDuplicate } from '../services/deduplicationService.js';
import { routeIssue, calculateSLADeadline } from '../services/routingService.js';
import { getVoteWeight, computeCrowdSeverity, updateCitizenReputation, checkAnomaly } from '../services/reputationService.js';
import { simpleImageHash } from '../utils/similarity.js';

const CATEGORIES = {
  roads: ['pothole', 'road_damage', 'traffic_signal', 'footpath', 'bridge'],
  water: ['pipe_burst', 'no_water_supply', 'waterlogging', 'contamination'],
  sanitation: ['garbage_dump', 'sewage_overflow', 'public_toilet'],
  electricity: ['power_outage', 'streetlight', 'dangerous_wiring'],
  public_safety: ['crime', 'accident', 'fire_hazard'],
  environment: ['air_pollution', 'noise_pollution', 'tree_felling'],
  health: ['stray_animals', 'mosquito_breeding', 'hospital_issue'],
  other: ['general']
};

export const getCategories = (req, res) => {
  res.json({ success: true, categories: CATEGORIES });
};

export const createIssue = async (req, res) => {
  try {
    const {
      title, description, category, subtype, longitude, latitude,
      address, severity, urgency, isAnonymous, visibility, language, offlineCreated
    } = req.body;

    if (!title || !description || !category || !longitude || !latitude) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const user = req.user;
    const recentInArea = await Issue.countDocuments({
      reportedBy: user._id,
      createdAt: { $gte: new Date(Date.now() - 3600000) },
      location: {
        $geoWithin: {
          $centerSphere: [[parseFloat(longitude), parseFloat(latitude)], 50 / 6371000]
        }
      }
    });

    const anomaly = checkAnomaly(user, recentInArea);
    if (anomaly === 'shadow_ban') {
      return res.status(403).json({ success: false, message: 'Account restricted' });
    }

    const media = [];
    const imageHashes = [];
    if (req.files?.length) {
      for (const file of req.files) {
        const isImage = file.mimetype.startsWith('image/');
        let url = `/uploads/${file.filename}`;

        if (isImage) {
          const blurredPath = `uploads/blurred_${file.filename}`;
          await sharp(file.path)
            .blur(3)
            .toFile(blurredPath);
          const hash = simpleImageHash(fs.readFileSync(file.path));
          imageHashes.push(hash);
        }

        media.push({ url, type: isImage ? 'image' : 'video', blurred: isImage });
      }
    }

    let issueData = {
      title,
      description,
      category,
      subtype,
      location: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
      address,
      media,
      imageHashes,
      reportedBy: user._id,
      isAnonymous: isAnonymous === 'true' || isAnonymous === true,
      severity: { userReported: parseInt(severity) || 3, computed: parseInt(severity) || 3 },
      urgency: parseInt(urgency) || 3,
      visibility: visibility || 'public',
      language: language || 'en',
      offlineCreated: offlineCreated === 'true',
      reporters: [user._id]
    };

    issueData = prepareIssueFingerprints(issueData);

    // ── Step 1: Block same user re-submitting identical report ──
    const sameUserDup = await findSameUserDuplicate(
      user._id, category, issueData.textFingerprint, issueData.locationGrid
    );
    if (sameUserDup) {
      const cluster = await IssueCluster.findOne({ primaryIssueId: sameUserDup._id });
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        alreadyReportedByYou: true,
        message: 'You have already reported this issue. Duplicate submission blocked.',
        issue: await Issue.findById(sameUserDup._id).populate('primaryAuthority', 'name department'),
        cluster: { reportCount: cluster?.reportCount || sameUserDup.reportCount || 1 }
      });
    }

    const tempIssue = new Issue(issueData);
    const duplicates = await findDuplicates(tempIssue, user._id);

    if (duplicates.length > 0) {
      const primary = duplicates[0].issue;

      if (userAlreadyReported(primary, user._id)) {
        const cluster = await IssueCluster.findOne({ primaryIssueId: primary._id });
        return res.status(409).json({
          success: false,
          isDuplicate: true,
          alreadyReportedByYou: true,
          message: 'You have already reported this issue. It is tracked under the existing report.',
          issue: await Issue.findById(primary._id).populate('primaryAuthority', 'name department'),
          cluster: cluster ? { reportCount: cluster.reportCount } : { reportCount: primary.reportCount }
        });
      }

      const newIssue = await Issue.create(issueData);
      const { cluster } = await mergeIntoCluster(newIssue, primary, user._id);

      user.reportCount += 1;
      user.lastReportAt = new Date();
      await user.save();

      await AuditLog.create({
        action: 'duplicate_merged',
        entityType: 'Issue',
        entityId: primary._id,
        performedBy: user._id,
        metadata: { duplicateId: newIssue._id, score: duplicates[0].score, reason: duplicates[0].reason }
      });

      return res.status(201).json({
        success: true,
        isDuplicate: true,
        message: `Already reported by ${cluster.reportCount} users nearby`,
        issue: await Issue.findById(primary._id).populate('primaryAuthority', 'name department'),
        cluster: { reportCount: cluster.reportCount, issueIds: cluster.issueIds }
      });
    }

    const authorities = await routeIssue(issueData);
    issueData.assignedAuthorities = authorities.map(a => a._id);
    issueData.primaryAuthority = authorities[0]?._id;
    issueData.slaDeadline = authorities.length ? calculateSLADeadline(authorities) : null;

    // Race-condition guard: re-check right before insert
    const lastSecondDup = await findSameUserDuplicate(
      user._id, category, issueData.textFingerprint, issueData.locationGrid
    );
    if (lastSecondDup) {
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        alreadyReportedByYou: true,
        message: 'This issue was just reported. Duplicate blocked.',
        issue: await Issue.findById(lastSecondDup._id).populate('primaryAuthority', 'name department')
      });
    }

    const issue = await Issue.create(issueData);

    user.reportCount += 1;
    user.lastReportAt = new Date();
    user.areaContributions += 1;
    await user.save();
    await updateCitizenReputation(user._id, 'accurate_report');

    await AuditLog.create({
      action: 'issue_created',
      entityType: 'Issue',
      entityId: issue._id,
      performedBy: user._id
    });

    const populated = await Issue.findById(issue._id)
      .populate('primaryAuthority', 'name department slaHours')
      .populate('assignedAuthorities', 'name department');

    res.status(201).json({ success: true, isDuplicate: false, issue: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getIssues = async (req, res) => {
  try {
    const { status, category, lat, lng, radius, page = 1, limit = 20, assignedToMe } = req.query;
    const query = { isDuplicate: false, visibility: 'public' };

    if (status) query.status = status;
    if (category) query.category = category;

    if (assignedToMe === 'true' && req.user) {
      if (req.user.role === 'authority' && req.user.authorityId) {
        query.assignedAuthorities = req.user.authorityId;
      } else if (req.user.role === 'admin') {
        // admin sees all
      } else {
        query.reportedBy = req.user._id;
      }
    }

    if (lat && lng && radius) {
      query.location = {
        $geoWithin: {
          $centerSphere: [[parseFloat(lng), parseFloat(lat)], parseFloat(radius) / 6371000]
        }
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [issues, total] = await Promise.all([
      Issue.find(query)
        .populate('primaryAuthority', 'name department')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Issue.countDocuments(query)
    ]);

    res.json({ success: true, issues, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getIssue = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('primaryAuthority', 'name department reputation')
      .populate('assignedAuthorities', 'name department')
      .populate('reportedBy', 'name reputation.level')
      .populate('reporters', 'name reputation.level');

    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    let clusterInfo = null;
    if (issue.clusterId) {
      const cluster = await IssueCluster.findById(issue.clusterId);
      clusterInfo = { reportCount: cluster?.reportCount, mergedIssues: cluster?.issueIds?.length };
    }

    const lifecycleDurations = [];
    for (let i = 0; i < issue.lifecycle.length; i++) {
      const entry = issue.lifecycle[i];
      const duration = entry.exitedAt
        ? entry.exitedAt - entry.enteredAt
        : Date.now() - entry.enteredAt;
      lifecycleDurations.push({ stage: entry.stage, durationMs: duration, department: entry.department });
    }

    res.json({ success: true, issue, clusterInfo, lifecycleDurations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const voteIssue = async (req, res) => {
  try {
    const { vote } = req.body;
    if (!['up', 'down'].includes(vote)) {
      return res.status(400).json({ success: false, message: 'Invalid vote' });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    const existingIdx = issue.votes.findIndex(v => v.userId.toString() === req.user._id.toString());
    const weight = getVoteWeight(req.user);

    if (existingIdx >= 0) {
      const old = issue.votes[existingIdx].vote;
      if (old === 'up') issue.upvoteCount -= issue.votes[existingIdx].weight;
      else issue.downvoteCount -= issue.votes[existingIdx].weight;
      issue.votes[existingIdx] = { userId: req.user._id, vote, weight };
    } else {
      issue.votes.push({ userId: req.user._id, vote, weight });
    }

    if (vote === 'up') issue.upvoteCount += weight;
    else issue.downvoteCount += weight;

    issue.severity.computed = computeCrowdSeverity(issue);
    await issue.save();

    res.json({ success: true, upvoteCount: issue.upvoteCount, downvoteCount: issue.downvoteCount, computedSeverity: issue.severity.computed });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateIssueStatus = async (req, res) => {
  try {
    const { status, note, department } = req.body;
    const validTransitions = {
      open: ['acknowledged', 'in_progress'],
      acknowledged: ['in_progress'],
      in_progress: ['resolved'],
      resolved: ['verified', 'reopened'],
      reopened: ['in_progress'],
      verified: ['closed']
    };

    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    if (req.user.role === 'authority' && status === 'resolved' && !req.files?.length && !req.body.resolutionNote) {
      return res.status(400).json({ success: false, message: 'Please provide a resolution note describing the fix' });
    }

    const current = issue.lifecycle[issue.lifecycle.length - 1];
    if (current) current.exitedAt = new Date();

    const stageMap = {
      acknowledged: 'acknowledged',
      in_progress: 'in_progress',
      resolved: 'resolved',
      verified: 'verified',
      reopened: 'reopened'
    };

    issue.status = status;
    issue.lifecycle.push({
      stage: stageMap[status] || status,
      enteredAt: new Date(),
      department: department || req.user.role,
      note
    });

    if (status === 'resolved') {
      issue.resolvedAt = new Date();
      if (req.files?.length) {
        issue.resolutionProof = req.files.map(f => ({
          url: `/uploads/${f.filename}`,
          uploadedBy: req.user._id
        }));
      }
      if (req.body.resolutionNote) issue.resolutionNote = req.body.resolutionNote;
      issue.verificationStatus = 'pending';
    }

    await issue.save();

    await AuditLog.create({
      action: 'status_update',
      entityType: 'Issue',
      entityId: issue._id,
      performedBy: req.user._id,
      metadata: { status, note }
    });

    res.json({ success: true, issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const verifyResolution = async (req, res) => {
  try {
    const { resolved, comment } = req.body;
    const issue = await Issue.findById(req.params.id);

    if (!issue || issue.status !== 'resolved') {
      return res.status(400).json({ success: false, message: 'Issue not in resolved state' });
    }

    const existing = issue.verificationVotes.find(v => v.userId.toString() === req.user._id.toString());
    if (existing) {
      return res.status(400).json({ success: false, message: 'Already voted' });
    }

    issue.verificationVotes.push({ userId: req.user._id, resolved: resolved === true || resolved === 'true', comment });

    const approvals = issue.verificationVotes.filter(v => v.resolved).length;
    const rejections = issue.verificationVotes.filter(v => !v.resolved).length;
    const total = issue.verificationVotes.length;

    if (total >= 3) {
      if (approvals / total >= 0.6) {
        issue.status = 'verified';
        issue.verificationStatus = 'approved';
        issue.verifiedAt = new Date();
        issue.lifecycle.push({ stage: 'verified', enteredAt: new Date(), department: 'citizen_verification' });
        await updateCitizenReputation(req.user._id, 'verified_issue');
      } else if (rejections / total > 0.5) {
        issue.status = 'reopened';
        issue.verificationStatus = 'rejected';
        issue.lifecycle.push({ stage: 'reopened', enteredAt: new Date(), department: 'citizen_verification', note: 'Majority rejected resolution' });
      }
    }

    await issue.save();
    res.json({ success: true, verificationStatus: issue.verificationStatus, votes: { approvals, rejections, total } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const syncOfflineIssues = async (req, res) => {
  try {
    const { issues } = req.body;
    if (!Array.isArray(issues)) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const results = [];
    for (const offlineIssue of issues) {
      offlineIssue.offlineCreated = true;
      const mockReq = { ...req, body: offlineIssue, files: [] };
      const mockRes = {
        status: (code) => ({ json: (data) => results.push({ ...data, offlineId: offlineIssue.offlineId, statusCode: code }) })
      };
      await createIssue(mockReq, mockRes);
    }

    res.json({ success: true, synced: results.length, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getPublicFeed = async (req, res) => {
  try {
    const issues = await Issue.find({
      visibility: 'public',
      isDuplicate: false,
      status: { $nin: ['closed'] }
    })
      .select('title category status location severity createdAt reportCount lifecycle')
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit) || 50);

    res.json({
      success: true,
      feed: issues.map(i => ({
        id: i._id,
        title: i.title,
        category: i.category,
        status: i.status,
        lat: i.location.coordinates[1],
        lng: i.location.coordinates[0],
        severity: i.severity.computed,
        reportCount: i.reportCount,
        createdAt: i.createdAt,
        currentStage: i.lifecycle[i.lifecycle.length - 1]?.stage
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const RESOLVED_STATUSES = ['resolved', 'verified'];

// Keep duplicate clusters consistent after a bulk delete without deleting reports
// that were not selected by the admin action.
async function deleteIssuesAndRepairClusters(filter) {
  const issues = await Issue.find(filter).select('_id');
  const ids = issues.map(issue => issue._id);
  if (!ids.length) return 0;

  await Issue.deleteMany({ _id: { $in: ids } });

  const affectedClusters = await IssueCluster.find({ issueIds: { $in: ids } });
  for (const cluster of affectedClusters) {
    const remainingIds = cluster.issueIds.filter(id => !ids.some(deletedId => deletedId.equals(id)));
    if (!remainingIds.length) {
      await IssueCluster.deleteOne({ _id: cluster._id });
      continue;
    }

    const primaryId = remainingIds.some(id => id.equals(cluster.primaryIssueId))
      ? cluster.primaryIssueId
      : remainingIds[0];

    await Issue.updateMany(
      { _id: { $in: remainingIds } },
      { $set: { clusterId: cluster._id, duplicateOf: primaryId } }
    );
    await Issue.updateOne(
      { _id: primaryId },
      { $set: { isDuplicate: false, duplicateOf: null, reportCount: remainingIds.length } }
    );
    await Issue.updateMany(
      { _id: { $in: remainingIds, $ne: primaryId } },
      { $set: { isDuplicate: true, duplicateOf: primaryId } }
    );

    cluster.issueIds = remainingIds;
    cluster.primaryIssueId = primaryId;
    cluster.reportCount = remainingIds.length;
    await cluster.save();
  }

  return ids.length;
}

export const deleteAllResolved = async (req, res) => {
  try {
    if (req.body.confirm !== 'DELETE RESOLVED') {
      return res.status(400).json({ success: false, message: 'Confirmation required.' });
    }

    const totalDeleted = await deleteIssuesAndRepairClusters({
      status: { $in: RESOLVED_STATUSES }
    });

    await AuditLog.create({
      action: 'bulk_delete_resolved',
      entityType: 'Issue',
      entityId: req.user._id,
      performedBy: req.user._id,
      metadata: { deletedCount: totalDeleted }
    });

    res.json({
      success: true,
      message: `Deleted ${totalDeleted} resolved report(s)`,
      deletedCount: totalDeleted
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteAllIssues = async (req, res) => {
  try {
    const { confirm } = req.body;
    if (confirm !== 'DELETE ALL') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation required. Send { "confirm": "DELETE ALL" } in request body.'
      });
    }

    const [issueResult, clusterResult] = await Promise.all([
      Issue.deleteMany({}),
      IssueCluster.deleteMany({})
    ]);

    await AuditLog.create({
      action: 'bulk_delete_all',
      entityType: 'Issue',
      entityId: req.user._id,
      performedBy: req.user._id,
      metadata: { issuesDeleted: issueResult.deletedCount, clustersDeleted: clusterResult.deletedCount }
    });

    res.json({
      success: true,
      message: `Deleted all ${issueResult.deletedCount} report(s) from the system`,
      deletedCount: issueResult.deletedCount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
