import { Request, Response, NextFunction } from 'express';
import { getGoogleAuthUrl, handleGoogleCallback } from '../services/googleCalendar.service.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/error.middleware.js';
import { env } from '../config/env.js';

export async function getAuthUrl(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const authUrl = getGoogleAuthUrl(req.user.userId);

    res.json({
      success: true,
      data: {
        authUrl,
        isConfigured: Boolean(authUrl),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function handleCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      res.redirect(`${env.CLIENT_URL}/patient?calendar_error=missing_code`);
      return;
    }

    const userId = (state as string) || req.user?.userId;
    if (!userId) {
      res.redirect(`${env.CLIENT_URL}/patient?calendar_error=missing_user`);
      return;
    }

    const success = await handleGoogleCallback(code, userId);

    if (success) {
      res.redirect(`${env.CLIENT_URL}/patient?calendar_connected=true`);
    } else {
      res.redirect(`${env.CLIENT_URL}/patient?calendar_error=exchange_failed`);
    }
  } catch (error) {
    next(error);
  }
}

export async function getCalendarStatus(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { googleRefreshToken: true },
    });

    res.json({
      success: true,
      data: {
        isConnected: Boolean(user?.googleRefreshToken),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function disconnectCalendar(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { googleRefreshToken: null },
    });

    res.json({
      success: true,
      message: 'Google Calendar disconnected successfully',
    });
  } catch (error) {
    next(error);
  }
}
