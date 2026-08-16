import Issue from '../models/Issue.js';
import IssueCluster from '../models/IssueCluster.js';
import { computeDuplicateScore, createTextFingerprint, haversineDistance, getLocationGrid } from '../utils/similarity.js';

const DUPLICATE_THRESHOLD = 0.35;
const RADIUS_METERS = parseInt(process.env.DUPLICATE_RADIUS_METERS) || 200;
const SAME_USER_RADIUS = 100;

function addMatch(matches, issue, score, reason) {
  const id = issue._id.toString();
  const existing = matches.find(m => m.issue._id.toString() === id);
  if (existing) {
    if (score > existing.score) {
      existing.score = score;
      existing.reason = reason;
    }
  } else {
    matches.push({ issue, score, reason });
  }
}

/** Hard block: same user already filed this exact issue (text + category) */
export async function findSameUserDuplicate(reporterId, category, textFingerprint, locationGrid) {
  if (!reporterId || !textFingerprint) return null;

  const query = {
    isDuplicate: false,
    category,
    textFingerprint,
    $or: [{ reportedBy: reporterId }, { reporters: reporterId }],
    status: { $nin: ['closed', 'verified'] }
  };

  // Prefer same map grid cell if available
  if (locationGrid) {
    const gridMatch = await Issue.findOne({ ...query, locationGrid }).sort({ createdAt: -1 });
    if (gridMatch) return gridMatch;
  }

  return Issue.findOne(query).sort({ createdAt: -1 });
}

/** Find nearby duplicate from any user */
export async function findDuplicates(newIssue, reporterId) {
  const [lon, lat] = newIssue.location.coordinates;
  const radiusRadians = RADIUS_METERS / 6371000;
  const matches = [];

  const baseQuery = {
    category: newIssue.category,
    isDuplicate: false,
    status: { $nin: ['closed', 'verified'] }
  };

  // Strategy 1: Exact text fingerprint (any user, generous radius)
  if (newIssue.textFingerprint) {
    const fingerprintMatches = await Issue.find({
      ...baseQuery,
      textFingerprint: newIssue.textFingerprint
    }).limit(20);

    for (const existing of fingerprintMatches) {
      const [eLon, eLat] = existing.location.coordinates;
      const dist = haversineDistance(lat, lon, eLat, eLon);
      if (dist <= RADIUS_METERS * 5) {
        addMatch(matches, existing, dist <= RADIUS_METERS ? 0.98 : 0.88, 'exact_text_match');
      }
    }
  }

  // Strategy 2: Same location grid + same category
  if (newIssue.locationGrid) {
    const gridMatches = await Issue.find({
      ...baseQuery,
      locationGrid: newIssue.locationGrid
    }).limit(10);

    for (const existing of gridMatches) {
      const score = computeDuplicateScore(newIssue, existing, RADIUS_METERS);
      addMatch(matches, existing, Math.max(score, 0.75), 'same_grid');
    }
  }

  // Strategy 3: Same user in same area (blocks repeat clicks)
  if (reporterId) {
    try {
      const userMatches = await Issue.find({
        ...baseQuery,
        $or: [{ reportedBy: reporterId }, { reporters: reporterId }],
        location: {
          $geoWithin: {
            $centerSphere: [[lon, lat], SAME_USER_RADIUS / 6371000]
          }
        }
      }).limit(10);

      for (const existing of userMatches) {
        addMatch(matches, existing, 0.95, 'same_user_same_area');
      }
    } catch (err) {
      console.warn('Geo query failed (index may be missing):', err.message);
    }
  }

  // Strategy 4: Geo-spatial nearby issues
  try {
    const nearbyIssues = await Issue.find({
      ...baseQuery,
      location: {
        $geoWithin: {
          $centerSphere: [[lon, lat], radiusRadians]
        }
      }
    }).limit(30);

    for (const existing of nearbyIssues) {
      const score = computeDuplicateScore(newIssue, existing, RADIUS_METERS);
      if (score >= DUPLICATE_THRESHOLD) {
        addMatch(matches, existing, score, 'geo_text_match');
      }
    }
  } catch (err) {
    console.warn('Nearby geo query failed:', err.message);
  }

  // Strategy 5: Similar title in same category (fallback)
  if (matches.length === 0 && newIssue.title?.length >= 4) {
    const titlePrefix = newIssue.title.trim().slice(0, 24);
    const titleMatches = await Issue.find({
      ...baseQuery,
      title: { $regex: titlePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
    }).limit(10);

    for (const existing of titleMatches) {
      const score = computeDuplicateScore(newIssue, existing, RADIUS_METERS * 2);
      if (score >= DUPLICATE_THRESHOLD) {
        addMatch(matches, existing, score, 'title_similarity');
      }
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
}

export async function mergeIntoCluster(newIssue, primaryIssue, reporterId) {
  let cluster = await IssueCluster.findOne({ primaryIssueId: primaryIssue._id });

  if (!cluster) {
    cluster = await IssueCluster.create({
      primaryIssueId: primaryIssue._id,
      issueIds: [primaryIssue._id],
      reportCount: primaryIssue.reportCount || 1,
      location: primaryIssue.location,
      category: primaryIssue.category,
      subtype: primaryIssue.subtype,
      title: primaryIssue.title,
      status: primaryIssue.status
    });
    primaryIssue.clusterId = cluster._id;
    await primaryIssue.save();
  }

  newIssue.isDuplicate = true;
  newIssue.duplicateOf = primaryIssue._id;
  newIssue.clusterId = cluster._id;
  newIssue.status = primaryIssue.status;
  await newIssue.save();

  cluster.issueIds.push(newIssue._id);
  cluster.reportCount += 1;
  await cluster.save();

  primaryIssue.reportCount = (primaryIssue.reportCount || 1) + 1;
  if (reporterId && !primaryIssue.reporters.some(r => r.toString() === reporterId.toString())) {
    primaryIssue.reporters.push(reporterId);
  }
  await primaryIssue.save();

  return { cluster, primaryIssue };
}

export function prepareIssueFingerprints(issueData) {
  issueData.textFingerprint = createTextFingerprint(
    `${issueData.title} ${issueData.description}`
  );
  const [lon, lat] = issueData.location.coordinates;
  issueData.locationGrid = getLocationGrid(lat, lon);
  return issueData;
}

export function userAlreadyReported(primaryIssue, reporterId) {
  if (!reporterId || !primaryIssue) return false;
  const id = reporterId.toString();
  if (primaryIssue.reportedBy?.toString() === id) return true;
  return primaryIssue.reporters?.some(r => r.toString() === id) ?? false;
}
