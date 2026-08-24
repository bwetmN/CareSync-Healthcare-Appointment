import { prisma } from '../config/database.js';
import { AppError } from '../middleware/error.middleware.js';
import {
  enqueueEmail,
  getDoctorLeaveAlertTemplate,
  dispatchOutboxEmail,
} from './email.service.js';
import { deleteCalendarEvent } from './googleCalendar.service.js';
import { env } from '../config/env.js';

/**
 * Preview appointments that would be affected by a doctor taking leave on a date
 */
export async function previewLeaveConflicts(doctorId: string, leaveDate: string) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!doctor) {
    throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');
  }

  const affectedAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      appointmentDate: leaveDate,
      status: 'BOOKED',
    },
    include: {
      patient: { select: { id: true, name: true, email: true, phone: true } },
    },
    orderBy: { startTime: 'asc' },
  });

  return {
    doctor,
    leaveDate,
    conflictCount: affectedAppointments.length,
    affectedAppointments,
  };
}

/**
 * Apply a doctor leave date, cancel conflicting appointments, and notify affected patients
 */
export async function applyDoctorLeave(doctorId: string, leaveDate: string, reason?: string) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: { user: true },
  });

  if (!doctor) {
    throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');
  }

  // Create leave record and update affected appointments in transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Check if leave already exists
    const existingLeave = await tx.doctorLeave.findUnique({
      where: { doctorId_leaveDate: { doctorId, leaveDate } },
    });

    if (existingLeave) {
      throw new AppError('Doctor is already marked on leave for this date', 400, 'LEAVE_ALREADY_EXISTS');
    }

    // 2. Create leave
    const leave = await tx.doctorLeave.create({
      data: {
        doctorId,
        leaveDate,
        reason: reason || 'Scheduled personal leave',
      },
    });

    // 3. Find all confirmed appointments on this date
    const conflictingAppts = await tx.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: leaveDate,
        status: 'BOOKED',
      },
      include: { patient: true },
    });

    // 4. Update status to LEAVE_CONFLICT
    if (conflictingAppts.length > 0) {
      await tx.appointment.updateMany({
        where: {
          doctorId,
          appointmentDate: leaveDate,
          status: 'BOOKED',
        },
        data: { status: 'LEAVE_CONFLICT' },
      });
    }

    // 5. Expire any active slot holds on this date
    await tx.slotHold.updateMany({
      where: {
        doctorId,
        slotDate: leaveDate,
        status: 'ACTIVE',
      },
      data: { status: 'EXPIRED' },
    });

    return { leave, conflictingAppts };
  });

  // Post-transaction: Notify affected patients and clean up calendar invites
  for (const appt of result.conflictingAppts) {
    try {
      // Remove Google Calendar invite
      await deleteCalendarEvent(appt.id);

      // Build email notification
      const rescheduleUrl = `${env.CLIENT_URL}/patient?reschedule=${appt.id}&doctor=${doctorId}`;
      const emailHtml = getDoctorLeaveAlertTemplate({
        patientName: appt.patient.name,
        doctorName: doctor.user.name,
        date: appt.appointmentDate,
        reason: reason || 'Doctor unavailable',
        rescheduleUrl,
      });

      const outboxId = await enqueueEmail({
        to: appt.patient.email,
        recipientName: appt.patient.name,
        subject: `⚠️ Urgent: Appointment Schedule Change for Dr. ${doctor.user.name} on ${appt.appointmentDate}`,
        templateName: 'DOCTOR_LEAVE_ALERT',
        htmlBody: emailHtml,
      });

      // Dispatch asynchronously
      dispatchOutboxEmail(outboxId).catch(() => {});
    } catch (err) {
      console.error(`⚠️ Error notifying patient ${appt.patient.id} for leave conflict:`, err);
    }
  }

  return {
    leave: result.leave,
    affectedCount: result.conflictingAppts.length,
    affectedAppointments: result.conflictingAppts,
  };
}

/**
 * Cancel / Remove a doctor leave
 */
export async function removeDoctorLeave(doctorId: string, leaveDate: string) {
  const leave = await prisma.doctorLeave.findUnique({
    where: { doctorId_leaveDate: { doctorId, leaveDate } },
  });

  if (!leave) {
    throw new AppError('Leave record not found', 404, 'LEAVE_NOT_FOUND');
  }

  await prisma.doctorLeave.delete({
    where: { id: leave.id },
  });

  return { success: true, message: 'Leave removed successfully' };
}
