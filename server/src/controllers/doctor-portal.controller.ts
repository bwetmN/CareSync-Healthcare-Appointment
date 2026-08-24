import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { generatePostVisitSummary } from '../services/ai.service.js';
import { applyDoctorLeave, previewLeaveConflicts, removeDoctorLeave } from '../services/leave.service.js';
import { AppError } from '../middleware/error.middleware.js';

export async function getDoctorAgenda(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { date } = req.query;

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user.userId },
      include: { user: true },
    });

    if (!doctor) {
      throw new AppError('Doctor profile not found', 404, 'DOCTOR_NOT_FOUND');
    }

    const where: any = {
      doctorId: doctor.id,
    };

    if (date && typeof date === 'string') {
      where.appointmentDate = date;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, email: true, phone: true } },
        prescriptions: true,
      },
      orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
    });

    res.json({
      success: true,
      data: {
        doctor,
        appointments,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Submit post-visit clinical notes & prescriptions
 * Triggers LLM Post-Visit Summary:
 * "Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>"
 */
export async function submitConsultationNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params; // appointmentId
    const { clinicalNotes, prescriptions = [] } = req.body;

    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true, patient: true },
    });

    if (!appt) {
      throw new AppError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND');
    }

    if (appt.doctor.userId !== req.user?.userId && req.user?.role !== 'ADMIN') {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    // 1. Generate AI Patient-Friendly Summary & Medication Schedule
    const aiAnalysis = await generatePostVisitSummary(clinicalNotes);

    // 2. Save clinical notes, AI summary, and structured prescriptions in transaction
    const updated = await prisma.$transaction(async (tx) => {
      const updatedAppt = await tx.appointment.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          postVisitNotes: clinicalNotes,
          postVisitSummary: JSON.stringify(aiAnalysis),
        },
        include: { patient: true, doctor: { include: { user: true } } },
      });

      // Clear existing prescriptions if any
      await tx.prescription.deleteMany({
        where: { appointmentId: id },
      });

      // Insert new prescriptions
      const today = new Date().toISOString().split('T')[0];
      for (const item of prescriptions) {
        await tx.prescription.create({
          data: {
            appointmentId: id,
            patientId: appt.patientId,
            doctorId: appt.doctorId,
            medicationName: item.medicationName,
            dosage: item.dosage,
            frequency: item.frequency || 'DAILY',
            durationDays: parseInt(item.durationDays || '7', 10),
            instructions: item.instructions || 'Take as directed',
            startDate: item.startDate || today,
          },
        });
      }

      return updatedAppt;
    });

    const fullAppt = await prisma.appointment.findUnique({
      where: { id },
      include: { prescriptions: true, patient: true, doctor: { include: { user: true } } },
    });

    res.json({
      success: true,
      message: 'Consultation notes and AI patient summary saved successfully',
      data: fullAppt,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDoctorLeaves(req: Request, res: Response, next: NextFunction) {
  try {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user?.userId },
    });

    if (!doctor) {
      throw new AppError('Doctor profile not found', 404, 'DOCTOR_NOT_FOUND');
    }

    const leaves = await prisma.doctorLeave.findMany({
      where: { doctorId: doctor.id },
      orderBy: { leaveDate: 'asc' },
    });

    res.json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    next(error);
  }
}

export async function previewLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const { leaveDate } = req.query;

    if (!leaveDate || typeof leaveDate !== 'string') {
      throw new AppError('leaveDate query parameter is required (YYYY-MM-DD)', 400, 'MISSING_DATE');
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user?.userId },
    });

    if (!doctor) {
      throw new AppError('Doctor profile not found', 404, 'DOCTOR_NOT_FOUND');
    }

    const preview = await previewLeaveConflicts(doctor.id, leaveDate);

    res.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const { leaveDate, reason } = req.body;

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user?.userId },
    });

    if (!doctor) {
      throw new AppError('Doctor profile not found', 404, 'DOCTOR_NOT_FOUND');
    }

    const result = await applyDoctorLeave(doctor.id, leaveDate, reason);

    res.status(201).json({
      success: true,
      message: `Leave applied for ${leaveDate}. ${result.affectedCount} affected patient(s) notified.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const { leaveDate } = req.params;

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user?.userId },
    });

    if (!doctor) {
      throw new AppError('Doctor profile not found', 404, 'DOCTOR_NOT_FOUND');
    }

    const result = await removeDoctorLeave(doctor.id, leaveDate);

    res.json(result);
  } catch (error) {
    next(error);
  }
}
