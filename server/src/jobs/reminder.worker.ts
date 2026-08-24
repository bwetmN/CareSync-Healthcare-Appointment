import { prisma } from '../config/database.js';
import { enqueueEmail, dispatchOutboxEmail } from '../services/email.service.js';

export async function process24HourAppointmentReminders(): Promise<number> {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const upcomingAppts = await prisma.appointment.findMany({
    where: {
      appointmentDate: tomorrow,
      status: 'BOOKED',
    },
    include: {
      patient: true,
      doctor: { include: { user: true } },
    },
  });

  let count = 0;
  for (const appt of upcomingAppts) {
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="color: #0284c7;">⏰ Upcoming Appointment Reminder (Tomorrow)</h3>
        <p>Dear ${appt.patient.name},</p>
        <p>This is a gentle reminder for your consultation tomorrow with <strong>Dr. ${appt.doctor.user.name}</strong> (${appt.doctor.specialization}).</p>
        <p><strong>Time:</strong> ${appt.startTime} - ${appt.endTime}</p>
        <p><strong>Location:</strong> CareSync Clinical Suites / Telehealth Room</p>
        <p>Please arrive 10 minutes prior to your scheduled time.</p>
      </div>
    `;

    const outboxId = await enqueueEmail({
      to: appt.patient.email,
      recipientName: appt.patient.name,
      subject: `Reminder: Doctor Appointment Tomorrow at ${appt.startTime}`,
      templateName: 'APPOINTMENT_24H_REMINDER',
      htmlBody: emailHtml,
    });

    dispatchOutboxEmail(outboxId).catch(() => {});
    count++;
  }

  return count;
}

export async function cleanupExpiredSlotHolds(): Promise<number> {
  const now = new Date();
  const res = await prisma.slotHold.updateMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lt: now },
    },
    data: { status: 'EXPIRED' },
  });

  return res.count;
}
