import { Router } from 'express';
import { z } from 'zod';
import { listDoctors, getDoctorById, getSlots, createSlotHold } from '../controllers/doctor.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';

const router = Router();

const holdSchema = z.object({
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm'),
});

// Public search/browse
router.get('/', listDoctors);
router.get('/:id', getDoctorById);
router.get('/:id/slots', getSlots);

// Authenticated slot hold
router.post('/:id/hold', authenticateToken, validateRequest(holdSchema), createSlotHold);

export default router;
