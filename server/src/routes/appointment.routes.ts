import { Router } from 'express';
import { z } from 'zod';
import {
  createBooking,
  getMyAppointments,
  getAppointmentById,
  reschedule,
  cancel,
} from '../controllers/appointment.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';

const router = Router();

const bookingSchema = z.object({
  doctorId: z.string().min(1, 'doctorId is required'),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm'),
  symptoms: z.string().min(3, 'Please provide detailed symptoms for clinical triage'),
  holdToken: z.string().optional(),
});

const rescheduleSchema = z.object({
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  newStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm'),
  newEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm'),
});

router.post('/', authenticateToken, validateRequest(bookingSchema), createBooking);
router.get('/my', authenticateToken, getMyAppointments);
router.get('/:id', authenticateToken, getAppointmentById);
router.patch('/:id/reschedule', authenticateToken, validateRequest(rescheduleSchema), reschedule);
router.patch('/:id/cancel', authenticateToken, cancel);

export default router;
