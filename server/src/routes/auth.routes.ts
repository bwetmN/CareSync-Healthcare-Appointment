import { Router } from 'express';
import { z } from 'zod';
import { register, login, getMe, demoLogin } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name is required'),
  role: z.enum(['PATIENT', 'DOCTOR', 'ADMIN']).optional(),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const demoLoginSchema = z.object({
  role: z.enum(['PATIENT', 'DOCTOR', 'ADMIN']),
});

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/demo-login', validateRequest(demoLoginSchema), demoLogin);
router.get('/me', authenticateToken, getMe);

export default router;
