import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/error.middleware.js';
import { processEmailQueue } from '../jobs/email.worker.js';

export async function createDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      name,
      email,
      password,
      specialization,
      bio,
      consultationFee = 50.0,
      slotDurationMinutes = 30,
      workingStartTime = '09:00',
      workingEndTime = '17:00',
      workingDays = '1,2,3,4,5',
      phone,
    } = req.body;

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      throw new AppError('Email is already registered', 400, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password || 'Doctor123!', 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          passwordHash,
          role: 'DOCTOR',
          phone,
        },
      });

      const profile = await tx.doctorProfile.create({
        data: {
          userId: user.id,
          specialization,
          bio,
          consultationFee: parseFloat(consultationFee),
          slotDurationMinutes: parseInt(slotDurationMinutes, 10),
          workingStartTime,
          workingEndTime,
          workingDays,
        },
      });

      return { user, profile };
    });

    res.status(201).json({
      success: true,
      message: 'Doctor profile created successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params; // doctorProfileId
    const {
      name,
      specialization,
      bio,
      consultationFee,
      slotDurationMinutes,
      workingStartTime,
      workingEndTime,
      workingDays,
      phone,
    } = req.body;

    const profile = await prisma.doctorProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!profile) {
      throw new AppError('Doctor profile not found', 404, 'DOCTOR_NOT_FOUND');
    }

    await prisma.$transaction(async (tx) => {
      if (name || phone) {
        await tx.user.update({
          where: { id: profile.userId },
          data: {
            name: name || profile.user.name,
            phone: phone !== undefined ? phone : profile.user.phone,
          },
        });
      }

      await tx.doctorProfile.update({
        where: { id },
        data: {
          specialization: specialization || profile.specialization,
          bio: bio !== undefined ? bio : profile.bio,
          consultationFee: consultationFee !== undefined ? parseFloat(consultationFee) : profile.consultationFee,
          slotDurationMinutes: slotDurationMinutes !== undefined ? parseInt(slotDurationMinutes, 10) : profile.slotDurationMinutes,
          workingStartTime: workingStartTime || profile.workingStartTime,
          workingEndTime: workingEndTime || profile.workingEndTime,
          workingDays: workingDays || profile.workingDays,
        },
      });
    });

    const updated = await prisma.doctorProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    res.json({
      success: true,
      message: 'Doctor profile updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function getClinicAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const totalAppointments = await prisma.appointment.count();
    const completedAppointments = await prisma.appointment.count({ where: { status: 'COMPLETED' } });
    const bookedAppointments = await prisma.appointment.count({ where: { status: 'BOOKED' } });
    const cancelledAppointments = await prisma.appointment.count({ where: { status: 'CANCELLED' } });
    const leaveConflictAppointments = await prisma.appointment.count({ where: { status: 'LEAVE_CONFLICT' } });
    const totalDoctors = await prisma.doctorProfile.count();
    const totalPatients = await prisma.user.count({ where: { role: 'PATIENT' } });

    const totalEmailsSent = await prisma.emailOutbox.count({ where: { status: 'SENT' } });
    const pendingEmails = await prisma.emailOutbox.count({ where: { status: 'PENDING' } });
    const failedEmails = await prisma.emailOutbox.count({ where: { status: 'FAILED' } });

    res.json({
      success: true,
      data: {
        appointments: {
          total: totalAppointments,
          completed: completedAppointments,
          booked: bookedAppointments,
          cancelled: cancelledAppointments,
          leaveConflicts: leaveConflictAppointments,
        },
        clinic: {
          doctors: totalDoctors,
          patients: totalPatients,
        },
        emailOutbox: {
          sent: totalEmailsSent,
          pending: pendingEmails,
          failed: failedEmails,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getOutboxStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const outbox = await prisma.emailOutbox.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: outbox,
    });
  } catch (error) {
    next(error);
  }
}

export async function triggerEmailRetry(req: Request, res: Response, next: NextFunction) {
  try {
    const processed = await processEmailQueue();

    res.json({
      success: true,
      message: `Processed ${processed} email(s) from outbox queue.`,
    });
  } catch (error) {
    next(error);
  }
}
