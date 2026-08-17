import { Router } from 'express';
import {
  getAuthorities, getAuthority, getDashboard, getHeatmap,
  getChronicZonesData, runEscalation, exportData
} from '../controllers/analyticsController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/authorities', getAuthorities);
router.get('/authorities/:id', getAuthority);
router.get('/heatmap', getHeatmap);
router.get('/export', protect, authorize('admin'), exportData);

router.get('/dashboard', protect, authorize('admin', 'authority'), getDashboard);
router.get('/chronic-zones', protect, authorize('admin', 'authority'), getChronicZonesData);
router.post('/escalate', protect, authorize('admin'), runEscalation);

export default router;
