import { Router } from 'express';
import {
  getCategories, createIssue, getIssues, getIssue, voteIssue,
  updateIssueStatus, verifyResolution, syncOfflineIssues, getPublicFeed,
  deleteAllResolved, deleteAllIssues
} from '../controllers/issueController.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';
import { reportLimiter, voteLimiter } from '../middleware/rateLimiter.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.get('/categories', getCategories);
router.get('/feed', getPublicFeed);
router.get('/', optionalAuth, getIssues);
router.get('/:id', optionalAuth, getIssue);

router.post('/', protect, reportLimiter, upload.array('media', 5), createIssue);
router.post('/sync', protect, syncOfflineIssues);
router.post('/:id/vote', protect, voteLimiter, voteIssue);
router.post('/:id/verify', protect, verifyResolution);
router.patch('/:id/status', protect, authorize('authority', 'admin'), upload.array('resolutionProof', 3), updateIssueStatus);
// Destructive actions are deliberately admin-only and require an explicit confirmation value.
router.delete('/bulk/resolved', protect, authorize('admin'), deleteAllResolved);
router.delete('/bulk/all', protect, authorize('admin'), deleteAllIssues);

export default router;
