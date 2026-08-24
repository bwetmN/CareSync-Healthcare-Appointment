import { Router } from 'express';
import {
  getAuthUrl,
  handleCallback,
  getCalendarStatus,
  disconnectCalendar,
} from '../controllers/calendar.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/auth-url', authenticateToken, getAuthUrl);
router.get('/callback', handleCallback);
router.get('/status', authenticateToken, getCalendarStatus);
router.post('/disconnect', authenticateToken, disconnectCalendar);

export default router;
