import { prisma } from '../config/database.js';
import { generatePreVisitSummary } from './ai.service.js';
import {
  enqueueEmail,
  getBookingConfirmationTemplate,
  getDoctorAppointmentNotificationTemplate,
  getAppointmentCancellationTemplate,
  dispatchOutboxEmail,
} from './email.service.js';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from './googleCalendar.service.js';
import { AppError } from '../middleware/error.middleware.js';
import { AvailableSlot } from '../types/index.js';
import crypto from 'crypto';

/**
 * Generate time slots between startTime and endTime with duration in minutes
 */
function generateTimeSlots(startStr: string, endStr: string, durationMinutes: number): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];
  const [startHour, startMin] = startStr.split(':').map(Number);
  const [endHour, endMin] = endStr.split(':').map(Number);

  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  while (currentMinutes + durationMinutes <= endMinutes) {
    const slotStartH = Math.floor(currentMinutes / 60);
    const slotStartM = currentMinutes % 60;
    const slotEndMins = currentMinutes + durationMinutes;
    const slotEndH = Math.floor(slotEndMins / 60);
    const slotEndM = slotEndMins % 60;

    const startFormatted = `${String(slotStartH).padStart(2, '0')}:${String(slotStartM).padStart(2, '0')}`;
    const endFormatted = `${String(slotEndH).padStart(2, '0')}:${String(slotEndM).padStart(2, '0')}`;

    slots.push({ start: startFormatted, end: endFormatted });
    currentMinutes += durationMinutes;
  }

  return slots;
}

/**
 * Get available slots for a doctor on a specific date
 */
export async function getDoctorAvailableSlots(
  doctorId: string,
  date: string,
  currentPatientId?: string
): Promise<{ doctor: any; isLeave: boolean; slots: AvailableSlot[] }> {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!doctor) {
    throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');
  }

  // Check if doctor is on leave on this date
  const leave = await prisma.doctorLeave.findUnique({
    where: { doctorId_leaveDate: { doctorId, leaveDate: date } },
  });

  if (leave) {
    return { doctor, isLeave: true, slots: [] };
  }

  // Purge any expired slot holds before calculating availability
  const now = new Date();
  await prisma.slotHold.updateMany({
    where: {
      doctorId,
      slotDate: date,
      status: 'ACTIVE',
      expiresAt: { lt: now },
    },
    data: { status: 'EXPIRED' },
  });

  // Query confirmed active appointments for this doctor on this date
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      appointmentDate: date,
      status: { in: ['BOOKED', 'COMPLETED'] },
    },
    select: { startTime: true, endTime: true },
  });

  const bookedStarts = new Set(existingAppointments.map((a) => a.startTime));

  // Query active non-expired slot holds
  const activeHolds = await prisma.slotHold.findMany({
    where: {
      doctorId,
      slotDate: date,
      status: 'ACTIVE',
      expiresAt: { gt: now },
    },
    select: { startTime: true, patientId: true, expiresAt: true },
  });

  const holdMap = new Map(activeHolds.map((h) => [h.startTime, h]));

  const rawSlots = generateTimeSlots(
    doctor.workingStartTime,
    doctor.workingEndTime,
    doctor.slotDurationMinutes
  );

  const slots: AvailableSlot[] = rawSlots.map((s) => {
    const isBooked = bookedStarts.has(s.start);
    const hold = holdMap.get(s.start);

    // If hold belongs to the requesting patient, treat as available to them
    const isHeldByOther = hold ? hold.patientId !== currentPatientId : false;
    const isHeldByMe = hold ? hold.patientId === currentPatientId : false;

    const isAvailable = !isBooked && !isHeldByOther;

    return {
      startTime: s.start,
      endTime: s.end,
      isAvailable,
      isHeld: Boolean(hold),
      heldUntil: hold?.expiresAt,
    };
  });

  return { doctor, isLeave: false, slots };
}

/**
 * Acquire a 5-minute Slot Hold
 */
export async function holdSlot(params: {
  doctorId: string;
  patientId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
}): Promise<{ holdToken: string; expiresAt: Date }> {
  const { doctorId, patientId, slotDate, startTime, endTime } = params;

  const now = new Date();

  // Check doctor leave
  const leave = await prisma.doctorLeave.findUnique({
    where: { doctorId_leaveDate: { doctorId, leaveDate: slotDate } },
  });
  if (leave) {
    throw new AppError('Doctor is on leave on this date', 400, 'DOCTOR_ON_LEAVE');
  }

  // Atomic hold acquisition in transaction
  return await prisma.$transaction(async (tx) => {
    // 1. Check existing active appointments
    const existingAppt = await tx.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate: slotDate,
        startTime,
        status: { in: ['BOOKED', 'COMPLETED'] },
      },
    });

    if (existingAppt) {
      throw new AppError('This time slot is already booked', 409, 'SLOT_ALREADY_BOOKED');
    }

    // 2. Check existing active hold by another patient
    const existingHold = await tx.slotHold.findFirst({
      where: {
        doctorId,
        slotDate,
        startTime,
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
    });

    if (existingHold && existingHold.patientId !== patientId) {
      throw new AppError('This time slot is currently on hold by another patient', 409, 'SLOT_ON_HOLD');
    }

    // 3. Expire previous hold if same patient or renew
    if (existingHold && existingHold.patientId === patientId) {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL
      const updated = await tx.slotHold.update({
        where: { id: existingHold.id },
        data: { expiresAt },
      });
      return { holdToken: updated.holdToken, expiresAt: updated.expiresAt };
    }

    // 4. Create new slot hold
    const holdToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    return await tx.slotHold.create({
      data: {
        doctorId,
        patientId,
        slotDate,
        startTime,
        endTime,
        holdToken,
        expiresAt,
        status: 'ACTIVE',
      },
    });
  }, { timeout: 10000 });
}

/**
 * Confirm and Book Appointment with AI Symptom Triage Analysis
 */
export async function bookAppointment(params: {
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  symptoms: string;
  holdToken?: string;
}): Promise<any> {
  const { patientId, doctorId, appointmentDate, startTime, endTime, symptoms, holdToken } = params;

  // 1. Run AI Pre-Visit Triage Analysis (graceful fallback inside service)
  const aiAnalysis = await generatePreVisitSummary(symptoms);

  // 2. Execute atomic database transaction
  const appointment = await prisma.$transaction(async (tx) => {
    const now = new Date();

    // Check doctor leave
    const leave = await tx.doctorLeave.findUnique({
      where: { doctorId_leaveDate: { doctorId, leaveDate: appointmentDate } },
    });
    if (leave) {
      throw new AppError('Doctor is on leave on this date', 400, 'DOCTOR_ON_LEAVE');
    }

    // Check existing booking
    const existing = await tx.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate,
        startTime,
        status: { in: ['BOOKED', 'COMPLETED'] },
      },
    });

    if (existing) {
      throw new AppError('This time slot is already booked. Please choose another slot.', 409, 'DOUBLE_BOOKING_CONFLICT');
    }

    // Validate hold if token provided
    if (holdToken) {
      const hold = await tx.slotHold.findUnique({
        where: { holdToken },
      });

      if (hold && hold.status === 'ACTIVE') {
        if (hold.patientId !== patientId) {
          throw new AppError('Hold token belongs to another user', 403, 'INVALID_HOLD_TOKEN');
        }
        // Mark hold as converted
        await tx.slotHold.update({
          where: { id: hold.id },
          data: { status: 'CONVERTED' },
        });
      }
    }

    // Create the confirmed appointment
    const newAppointment = await tx.appointment.create({
      data: {
        patientId,
        doctorId,
        appointmentDate,
        startTime,
        endTime,
        status: 'BOOKED',
        symptoms,
        preVisitUrgency: aiAnalysis.urgency,
        preVisitSummary: aiAnalysis.chiefComplaint,
        preVisitQuestions: JSON.stringify(aiAnalysis.suggestedQuestions),
      },
      include: {
        patient: true,
        doctor: { include: { user: true } },
      },
    });

    return newAppointment;
  }, { timeout: 10000, maxWait: 5000 });

  // 3. Post-booking integrations: Google Calendar & Outbox Emails
  try {
    // Create Calendar Event
    await createCalendarEvent(appointment.id);

    // Enqueue Patient Confirmation Email
    const patientHtml = getBookingConfirmationTemplate({
      patientName: appointment.patient.name,
      doctorName: `Dr. ${appointment.doctor.user.name}`,
      specialization: appointment.doctor.specialization,
      date: appointment.appointmentDate,
      time: `${appointment.startTime} - ${appointment.endTime}`,
      urgency: appointment.preVisitUrgency || 'Low',
      chiefComplaint: appointment.preVisitSummary || symptoms,
    });

    const patientMailId = await enqueueEmail({
      to: appointment.patient.email,
      recipientName: appointment.patient.name,
      subject: `Appointment Confirmed: Dr. ${appointment.doctor.user.name} on ${appointment.appointmentDate}`,
      templateName: 'PATIENT_BOOKING_CONFIRMATION',
      htmlBody: patientHtml,
    });
    // Immediately dispatch asynchronously
    dispatchOutboxEmail(patientMailId).catch(() => {});

    // Enqueue Doctor Notification Email
    const doctorHtml = getDoctorAppointmentNotificationTemplate({
      doctorName: appointment.doctor.user.name,
      patientName: appointment.patient.name,
      date: appointment.appointmentDate,
      time: `${appointment.startTime} - ${appointment.endTime}`,
      urgency: appointment.preVisitUrgency || 'Low',
      chiefComplaint: appointment.preVisitSummary || symptoms,
      suggestedQuestions: aiAnalysis.suggestedQuestions,
    });

    const docMailId = await enqueueEmail({
      to: appointment.doctor.user.email,
      recipientName: appointment.doctor.user.name,
      subject: `New Patient Appointment: ${appointment.patient.name} (${appointment.appointmentDate} at ${appointment.startTime})`,
      templateName: 'DOCTOR_NEW_APPOINTMENT',
      htmlBody: doctorHtml,
    });
    dispatchOutboxEmail(docMailId).catch(() => {});
  } catch (error) {
    console.error('⚠️ Post-booking async notification warning:', error);
  }

  return appointment;
}

/**
 * Reschedule Appointment
 */
export async function rescheduleAppointment(params: {
  appointmentId: string;
  patientId: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
}): Promise<any> {
  const { appointmentId, patientId, newDate, newStartTime, newEndTime } = params;

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, doctor: { include: { user: true } } },
  });

  if (!appt) {
    throw new AppError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND');
  }

  if (appt.patientId !== patientId) {
    throw new AppError('Not authorized to reschedule this appointment', 403, 'FORBIDDEN');
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Check doctor leave
    const leave = await tx.doctorLeave.findUnique({
      where: { doctorId_leaveDate: { doctorId: appt.doctorId, leaveDate: newDate } },
    });
    if (leave) {
      throw new AppError('Doctor is on leave on the selected date', 400, 'DOCTOR_ON_LEAVE');
    }

    // Check slot availability
    const conflict = await tx.appointment.findFirst({
      where: {
        doctorId: appt.doctorId,
        appointmentDate: newDate,
        startTime: newStartTime,
        status: { in: ['BOOKED', 'COMPLETED'] },
        NOT: { id: appointmentId },
      },
    });

    if (conflict) {
      throw new AppError('Selected time slot is already booked', 409, 'SLOT_CONFLICT');
    }

    return await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        appointmentDate: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        status: 'BOOKED',
      },
      include: { patient: true, doctor: { include: { user: true } } },
    });
  });

  // Update Google Calendar
  await updateCalendarEvent(appointmentId, newDate, newStartTime, newEndTime);

  return updated;
}

/**
 * Cancel Appointment
 */
export async function cancelAppointment(appointmentId: string, userId: string, userRole: string): Promise<any> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, doctor: { include: { user: true } } },
  });

  if (!appt) {
    throw new AppError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND');
  }

  if (userRole === 'PATIENT' && appt.patientId !== userId) {
    throw new AppError('Not authorized to cancel this appointment', 403, 'FORBIDDEN');
  }

  if (userRole === 'DOCTOR' && appt.doctor.userId !== userId) {
    throw new AppError('Not authorized to cancel this appointment', 403, 'FORBIDDEN');
  }

  const cancelled = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CANCELLED' },
  });

  // Delete Calendar Event
  await deleteCalendarEvent(appointmentId);

  // Send cancellation email
  const cancelHtml = getAppointmentCancellationTemplate({
    userName: appt.patient.name,
    doctorName: `Dr. ${appt.doctor.user.name}`,
    date: appt.appointmentDate,
    time: `${appt.startTime} - ${appt.endTime}`,
  });

  const mailId = await enqueueEmail({
    to: appt.patient.email,
    subject: `Appointment Cancelled: ${appt.appointmentDate}`,
    templateName: 'APPOINTMENT_CANCELLED',
    htmlBody: cancelHtml,
  });
  dispatchOutboxEmail(mailId).catch(() => {});

  return cancelled;
}
