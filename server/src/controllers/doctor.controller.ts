import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { getDoctorAvailableSlots, holdSlot } from '../services/booking.service.js';
import { AppError } from '../middleware/error.middleware.js';

export async function listDoctors(req: Request, res: Response, next: NextFunction) {
  try {
    const { specialization, search } = req.query;

    const where: any = {};

    if (specialization && typeof specialization === 'string') {
      where.specialization = { contains: specialization };
    }

    const doctors = await prisma.doctorProfile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        leaves: {
          select: { leaveDate: true, reason: true },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    let filtered = doctors;
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      filtered = doctors.filter(
        (d) =>
          d.user.name.toLowerCase().includes(q) ||
          d.specialization.toLowerCase().includes(q) ||
          (d.bio && d.bio.toLowerCase().includes(q))
      );
    }

    res.json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDoctorById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        leaves: true,
      },
    });

    if (!doctor) {
      throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');
    }

    res.json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSlots(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date || typeof date !== 'string') {
      throw new AppError('Query parameter "date" (YYYY-MM-DD) is required', 400, 'MISSING_DATE');
    }

    const currentPatientId = req.user?.userId;
    const slotInfo = await getDoctorAvailableSlots(id, date, currentPatientId);

    res.json({
      success: true,
      data: slotInfo,
    });
  } catch (error) {
    next(error);
  }
}

export async function createSlotHold(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params; // doctorId
    const { slotDate, startTime, endTime } = req.body;

    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const holdResult = await holdSlot({
      doctorId: id,
      patientId: req.user.userId,
      slotDate,
      startTime,
      endTime,
    });

    res.json({
      success: true,
      message: 'Slot held successfully for 5 minutes',
      data: holdResult,
    });
  } catch (error) {
    next(error);
  }
}
