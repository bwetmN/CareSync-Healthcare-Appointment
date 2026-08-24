import { Router } from 'express';
import { z } from 'zod';
import {
  getDoctorAgenda,
  submitConsultationNotes,
  getDoctorLeaves,
  previewLeave,
  submitLeave,
  deleteLeave,
} from '../controllers/doctor-portal.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';

const router = Router();

// Require DOCTOR role for these endpoints
router.use(authenticateToken, authorizeRoles('DOCTOR', 'ADMIN'));

const consultationSchema = z.object({
  clinicalNotes: z.string().min(5, 'Clinical notes are required'),
  prescriptions: z
    .array(
      z.object({
        medicationName: z.string().min(1, 'Medication name required'),
        dosage: z.string().min(1, 'Dosage required'),
        frequency: z.string().default('DAILY'),
        durationDays: z.number().or(z.string()).default(7),
        instructions: z.string().optional(),
        startDate: z.string().optional(),
      })
    )
    .optional(),
});

const leaveSchema = z.object({
  leaveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reason: z.string().optional(),
});

router.get('/agenda', getDoctorAgenda);
router.post('/appointments/:id/consultation', validateRequest(consultationSchema), submitConsultationNotes);
router.get('/leaves', getDoctorLeaves);
router.get('/leaves/preview', previewLeave);
router.post('/leaves', validateRequest(leaveSchema), submitLeave);
router.delete('/leaves/:leaveDate', deleteLeave);

export default router;
