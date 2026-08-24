import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { bookAppointment, rescheduleAppointment, cancelAppointment } from '../services/booking.service.js';
import { AppError } from '../middleware/error.middleware.js';

export async function createBooking(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { doctorId, appointmentDate, startTime, endTime, symptoms, holdToken } = req.body;

    const appointment = await bookAppointment({
      patientId: req.user.userId,
      doctorId,
      appointmentDate,
      startTime,
      endTime,
      symptoms,
      holdToken,
    });

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { role, userId } = req.user;
    let where: any = {};

    if (role === 'PATIENT') {
      where.patientId = userId;
    } else if (role === 'DOCTOR') {
      const doc = await prisma.doctorProfile.findUnique({
        where: { userId },
      });
      if (!doc) {
        throw new AppError('Doctor profile not found', 404, 'DOCTOR_NOT_FOUND');
      }
      where.doctorId = doc.id;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, email: true, phone: true } },
        doctor: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
        prescriptions: true,
      },
      orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
    });

    res.json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAppointmentById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, email: true, phone: true } },
        doctor: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
        prescriptions: true,
      },
    });

    if (!appt) {
      throw new AppError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND');
    }

    // Auth check
    if (
      req.user?.role === 'PATIENT' &&
      appt.patientId !== req.user.userId
    ) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    res.json({
      success: true,
      data: appt,
    });
  } catch (error) {
    next(error);
  }
}

export async function reschedule(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;
    const { newDate, newStartTime, newEndTime } = req.body;

    const updated = await rescheduleAppointment({
      appointmentId: id,
      patientId: req.user.userId,
      newDate,
      newStartTime,
      newEndTime,
    });

    res.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;

    const cancelled = await cancelAppointment(id, req.user.userId, req.user.role);

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: cancelled,
    });
  } catch (error) {
    next(error);
  }
}
