import Authority from '../models/Authority.js';
import {
  getHeatmapData, getDepartmentBottlenecks, getSeasonalPatterns,
  getChronicZones, getPredictiveInsights, getDashboardStats,
  getCategoryBreakdown, getStatusBreakdown, getReportsTimeline,
  getRecentIssues, getUserStats
} from '../services/analyticsService.js';
import { checkSLABreaches } from '../services/routingService.js';

export const getAuthorities = async (req, res) => {
  try {
    const authorities = await Authority.find({ isActive: true }).select('-jurisdiction');
    res.json({ success: true, authorities });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAuthority = async (req, res) => {
  try {
    const authority = await Authority.findById(req.params.id);
    if (!authority) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, authority });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDashboard = async (req, res) => {
  try {
    const [
      stats, bottlenecks, insights, seasonal,
      categories, statuses, timeline, recentIssues, userStats
    ] = await Promise.all([
      getDashboardStats(),
      getDepartmentBottlenecks(),
      getPredictiveInsights(),
      getSeasonalPatterns(),
      getCategoryBreakdown(),
      getStatusBreakdown(),
      getReportsTimeline(30),
      getRecentIssues(15),
      getUserStats()
    ]);

    res.json({
      success: true,
      stats,
      bottlenecks,
      insights,
      seasonal,
      categories,
      statuses,
      timeline,
      recentIssues,
      userStats
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getHeatmap = async (req, res) => {
  try {
    const { north, south, east, west, category } = req.query;
    const bounds = (north && south && east && west)
      ? { north: parseFloat(north), south: parseFloat(south), east: parseFloat(east), west: parseFloat(west) }
      : null;

    const data = await getHeatmapData(bounds, category);
    res.json({ success: true, heatmap: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getChronicZonesData = async (req, res) => {
  try {
    const zones = await getChronicZones();
    res.json({ success: true, zones });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const runEscalation = async (req, res) => {
  try {
    const count = await checkSLABreaches();
    res.json({ success: true, escalated: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const exportData = async (req, res) => {
  try {
    const Issue = (await import('../models/Issue.js')).default;
    const { format = 'json', category, status } = req.query;
    const query = { isDuplicate: false, visibility: 'public' };
    if (category) query.category = category;
    if (status) query.status = status;

    const issues = await Issue.find(query)
      .select('title description category status location severity createdAt resolvedAt reportCount lifecycle')
      .limit(1000);

    if (format === 'csv') {
      const header = 'id,title,category,status,lat,lng,severity,reports,createdAt,resolvedAt\n';
      const rows = issues.map(i =>
        `${i._id},"${i.title}",${i.category},${i.status},${i.location.coordinates[1]},${i.location.coordinates[0]},${i.severity.computed},${i.reportCount},${i.createdAt},${i.resolvedAt || ''}`
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="janseva-reports.csv"');
      res.send(header + rows);
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="janseva-reports.json"');
      res.json({ success: true, count: issues.length, data: issues });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
