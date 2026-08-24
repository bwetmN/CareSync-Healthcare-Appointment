import { Router } from 'express';
import { z } from 'zod';
import {
  createDoctor,
  updateDoctor,
  getClinicAnalytics,
  getOutboxStatus,
  triggerEmailRetry,
} from '../controllers/admin.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';

const router = Router();

// Require ADMIN role
router.use(authenticateToken, authorizeRoles('ADMIN'));

const createDoctorSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6).optional(),
  specialization: z.string().min(2, 'Specialization is required'),
  bio: z.string().optional(),
  consultationFee: z.number().or(z.string()).optional(),
  slotDurationMinutes: z.number().or(z.string()).optional(),
  workingStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workingEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workingDays: z.string().optional(),
  phone: z.string().optional(),
});

router.post('/doctors', validateRequest(createDoctorSchema), createDoctor);
router.patch('/doctors/:id', updateDoctor);
router.get('/analytics', getClinicAnalytics);
router.get('/outbox', getOutboxStatus);
router.post('/outbox/retry', triggerEmailRetry);

export default router;
