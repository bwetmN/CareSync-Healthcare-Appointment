import { prisma } from '../config/database.js';
import {
  enqueueEmail,
  getMedicationReminderTemplate,
  dispatchOutboxEmail,
} from '../services/email.service.js';

export async function processMedicationReminders(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  // Find prescriptions where today falls within start_date + duration_days
  const activePrescriptions = await prisma.prescription.findMany({
    include: {
      patient: true,
      doctor: { include: { user: true } },
    },
  });

  let dispatchedCount = 0;

  for (const pres of activePrescriptions) {
    const startDate = new Date(pres.startDate);
    const endDate = new Date(startDate.getTime() + pres.durationDays * 24 * 60 * 60 * 1000);

    // Check if prescription is active today
    if (now < startDate || now > endDate) {
      continue;
    }

    // Determine expected doses for today based on frequency
    const expectedTypes: string[] = [];
    if (pres.frequency === 'ONCE_DAILY') {
      expectedTypes.push('DAILY_DOSE');
    } else if (pres.frequency === 'TWICE_DAILY') {
      expectedTypes.push('MORNING_DOSE', 'EVENING_DOSE');
    } else if (pres.frequency === 'THRICE_DAILY') {
      expectedTypes.push('MORNING_DOSE', 'AFTERNOON_DOSE', 'EVENING_DOSE');
    } else {
      expectedTypes.push('SCHEDULED_DOSE');
    }

    for (const doseType of expectedTypes) {
      // Check if reminder was already scheduled/sent for today
      const startOfDay = new Date(today);
      const endOfDay = new Date(today + 'T23:59:59.999Z');

      const existingLog = await prisma.medicationReminderLog.findFirst({
        where: {
          prescriptionId: pres.id,
          reminderType: doseType,
          scheduledFor: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      if (!existingLog) {
        // Create reminder log
        const log = await prisma.medicationReminderLog.create({
          data: {
            prescriptionId: pres.id,
            scheduledFor: now,
            status: 'PENDING',
            reminderType: doseType,
          },
        });

        // Enqueue email
        const emailHtml = getMedicationReminderTemplate({
          patientName: pres.patient.name,
          medicationName: pres.medicationName,
          dosage: pres.dosage,
          instructions: pres.instructions || 'Take as directed.',
          reminderType: doseType,
        });

        const outboxId = await enqueueEmail({
          to: pres.patient.email,
          recipientName: pres.patient.name,
          subject: `💊 Medication Reminder: ${pres.medicationName} (${pres.dosage})`,
          templateName: 'MEDICATION_REMINDER',
          htmlBody: emailHtml,
        });

        const sent = await dispatchOutboxEmail(outboxId);

        await prisma.medicationReminderLog.update({
          where: { id: log.id },
          data: {
            status: sent ? 'SENT' : 'FAILED',
            sentAt: sent ? new Date() : null,
          },
        });

        dispatchedCount++;
      }
    }
  }

  return dispatchedCount;
}
