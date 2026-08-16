import Issue from '../models/Issue.js';
import User from '../models/User.js';
import IssueCluster from '../models/IssueCluster.js';

export async function getHeatmapData(bounds, category) {
  const query = { status: { $nin: ['closed'] }, isDuplicate: false };
  if (category) query.category = category;
  if (bounds) {
    query.location = {
      $geoWithin: {
        $box: [[bounds.west, bounds.south], [bounds.east, bounds.north]]
      }
    };
  }

  const issues = await Issue.find(query).select('location category severity status createdAt');

  return issues.map(i => ({
    lat: i.location.coordinates[1],
    lng: i.location.coordinates[0],
    weight: i.severity?.computed || 3,
    category: i.category,
    status: i.status
  }));
}

export async function getDepartmentBottlenecks() {
  return Issue.aggregate([
    { $match: { isDuplicate: false, status: { $nin: ['verified', 'closed'] } } },
    { $unwind: '$assignedAuthorities' },
    {
      $group: {
        _id: '$assignedAuthorities',
        openCount: { $sum: 1 },
        avgAge: { $avg: { $subtract: [new Date(), '$createdAt'] } },
        breachedSLA: {
          $sum: { $cond: [{ $lt: ['$slaDeadline', new Date()] }, 1, 0] }
        }
      }
    },
    { $lookup: { from: 'authorities', localField: '_id', foreignField: '_id', as: 'authority' } },
    { $unwind: '$authority' },
    {
      $project: {
        department: '$authority.department',
        name: '$authority.name',
        openCount: 1,
        avgAgeDays: { $divide: ['$avgAge', 1000 * 60 * 60 * 24] },
        breachedSLA: 1
      }
    },
    { $sort: { openCount: -1 } }
  ]);
}

export async function getCategoryBreakdown() {
  return Issue.aggregate([
    { $match: { isDuplicate: false } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
}

export async function getStatusBreakdown() {
  return Issue.aggregate([
    { $match: { isDuplicate: false } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
}

export async function getReportsTimeline(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const timeline = await Issue.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          isDuplicate: '$isDuplicate'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);

  const byDate = {};
  timeline.forEach(row => {
    const date = row._id.date;
    if (!byDate[date]) byDate[date] = { date, newReports: 0, duplicatesBlocked: 0 };
    if (row._id.isDuplicate) byDate[date].duplicatesBlocked += row.count;
    else byDate[date].newReports += row.count;
  });

  return Object.values(byDate);
}

export async function getRecentIssues(limit = 10) {
  return Issue.find({ isDuplicate: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title category status severity reportCount createdAt address')
    .lean();
}

export async function getUserStats() {
  const [totalUsers, citizens, officers, admins, totalClusters] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'citizen' }),
    User.countDocuments({ role: 'authority' }),
    User.countDocuments({ role: 'admin' }),
    IssueCluster.countDocuments()
  ]);

  return { totalUsers, citizens, officers, admins, totalClusters };
}

export async function getSeasonalPatterns() {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  return Issue.aggregate([
    { $match: { createdAt: { $gte: twelveMonthsAgo }, isDuplicate: false } },
    {
      $group: {
        _id: { month: { $month: '$createdAt' }, category: '$category' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.month': 1 } }
  ]);
}

export async function getChronicZones(radiusMeters = 200) {
  const openIssues = await Issue.find({
    status: { $nin: ['verified', 'closed'] },
    isDuplicate: false
  });

  const zones = [];
  const visited = new Set();

  for (const issue of openIssues) {
    if (visited.has(issue._id.toString())) continue;
    const [lon, lat] = issue.location.coordinates;
    const radiusRadians = radiusMeters / 6371000;

    try {
      const cluster = await Issue.find({
        _id: { $ne: issue._id },
        location: { $geoWithin: { $centerSphere: [[lon, lat], radiusRadians] } },
        category: issue.category,
        status: { $nin: ['verified', 'closed'] },
        isDuplicate: false
      });

      if (cluster.length >= 2) {
        zones.push({
          center: { lat, lng: lon },
          category: issue.category,
          issueCount: cluster.length + 1,
          issueIds: [issue._id, ...cluster.map(c => c._id)]
        });
        visited.add(issue._id.toString());
        cluster.forEach(c => visited.add(c._id.toString()));
      }
    } catch { /* skip if geo index missing */ }
  }

  return zones;
}

/** Only insights derived from actual database records */
export async function getPredictiveInsights() {
  const insights = [];
  const stats = await getDashboardStats();
  const chronicZones = await getChronicZones();
  const bottlenecks = await getDepartmentBottlenecks();
  const categoryBreakdown = await getCategoryBreakdown();

  if (stats.duplicateReportsMerged > 0) {
    insights.push({
      type: 'dedup',
      message: `${stats.duplicateReportsMerged} duplicate report(s) merged — deduplication is active`,
      confidence: 1
    });
  }

  if (stats.open > 0) {
    insights.push({
      type: 'active',
      message: `${stats.open} issue(s) currently awaiting resolution across all departments`,
      confidence: 1
    });
  }

  categoryBreakdown.slice(0, 2).forEach(cat => {
    if (cat.count > 0) {
      insights.push({
        type: 'category',
        message: `Most reported category: ${cat._id.replace('_', ' ')} (${cat.count} issue${cat.count > 1 ? 's' : ''})`,
        confidence: 1
      });
    }
  });

  chronicZones.slice(0, 3).forEach(zone => {
    insights.push({
      type: 'chronic_zone',
      message: `Hotspot: ${zone.issueCount} open ${zone.category} issues within 200m`,
      location: zone.center,
      confidence: 1
    });
  });

  bottlenecks.filter(b => b.breachedSLA > 0).slice(0, 3).forEach(b => {
    insights.push({
      type: 'bottleneck',
      message: `${b.name}: ${b.breachedSLA} SLA breach(es), ${b.openCount} open issue(s)`,
      department: b.department,
      confidence: 1
    });
  });

  if (stats.avgResolutionHours > 0) {
    insights.push({
      type: 'performance',
      message: `Average resolution time: ${stats.avgResolutionHours.toFixed(1)} hours (from resolved issues)`,
      confidence: 1
    });
  }

  return insights;
}

export async function getDashboardStats() {
  const [
    total, open, acknowledged, inProgress, resolved, verified, reopened,
    duplicates, clusters
  ] = await Promise.all([
    Issue.countDocuments({ isDuplicate: false }),
    Issue.countDocuments({ status: 'open', isDuplicate: false }),
    Issue.countDocuments({ status: 'acknowledged', isDuplicate: false }),
    Issue.countDocuments({ status: 'in_progress', isDuplicate: false }),
    Issue.countDocuments({ status: 'resolved', isDuplicate: false }),
    Issue.countDocuments({ status: 'verified', isDuplicate: false }),
    Issue.countDocuments({ status: 'reopened', isDuplicate: false }),
    Issue.countDocuments({ isDuplicate: true }),
    IssueCluster.countDocuments()
  ]);

  const active = open + acknowledged + inProgress + reopened;

  const avgResolution = await Issue.aggregate([
    { $match: { resolvedAt: { $exists: true }, isDuplicate: false } },
    { $group: { _id: null, avgHours: { $avg: { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 3600000] } } } }
  ]);

  const totalReports = await Issue.countDocuments();
  const uniqueIssues = total;
  const dedupRate = totalReports > 0 ? ((duplicates / totalReports) * 100).toFixed(1) : 0;

  return {
    total,
    totalReports,
    open,
    acknowledged,
    inProgress,
    resolved,
    verified,
    reopened,
    active,
    duplicateReportsMerged: duplicates,
    issueClusters: clusters,
    dedupRate,
    avgResolutionHours: avgResolution[0]?.avgHours || 0,
    resolutionRate: total ? (((resolved + verified) / total) * 100).toFixed(1) : '0'
  };
}
