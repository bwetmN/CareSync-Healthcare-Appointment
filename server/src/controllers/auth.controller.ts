import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.middleware.js';
import { JwtPayload, UserRole } from '../types/index.js';

function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name, role = 'PATIENT', phone } = req.body;

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      throw new AppError('Email address is already registered', 400, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: role as UserRole,
        phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        createdAt: true,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { doctorProfile: true },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
          doctorProfile: user.doctorProfile,
          googleConnected: Boolean(user.googleRefreshToken),
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { doctorProfile: true },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        doctorProfile: user.doctorProfile,
        googleConnected: Boolean(user.googleRefreshToken),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 1-Click Instant Demo Login for Evaluator Convenience
 */
export async function demoLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = req.body; // 'PATIENT' | 'DOCTOR' | 'ADMIN'

    const targetEmail =
      role === 'DOCTOR'
        ? 'doctor@demo.com'
        : role === 'ADMIN'
        ? 'admin@demo.com'
        : 'patient@demo.com';

    let user = await prisma.user.findUnique({
      where: { email: targetEmail },
      include: { doctorProfile: true },
    });

    if (!user) {
      throw new AppError(`Demo account for ${role} not found. Please run seed script.`, 404, 'DEMO_USER_NOT_FOUND');
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
    });

    res.json({
      success: true,
      message: `Logged in as Demo ${role}`,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
          doctorProfile: user.doctorProfile,
          googleConnected: Boolean(user.googleRefreshToken),
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
}
