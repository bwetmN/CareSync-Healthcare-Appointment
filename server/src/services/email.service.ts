import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  } else {
    // Generate an automatic Ethereal test account for local dev / demo testing
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`📧 Ethereal test mail inbox active: ${testAccount.user}`);
  }

  return transporter;
}

export interface SendEmailOptions {
  to: string;
  recipientName?: string;
  subject: string;
  templateName: string;
  htmlBody: string;
}

/**
 * Enqueue an email into the database outbox for transactional durability
 */
export async function enqueueEmail(options: SendEmailOptions): Promise<string> {
  const outboxEntry = await prisma.emailOutbox.create({
    data: {
      recipientEmail: options.to,
      recipientName: options.recipientName || 'User',
      subject: options.subject,
      templateName: options.templateName,
      htmlBody: options.htmlBody,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 5,
      nextRetryAt: new Date(),
    },
  });

  return outboxEntry.id;
}

/**
 * Directly dispatch an outbox entry and update status
 */
export async function dispatchOutboxEmail(outboxId: string): Promise<boolean> {
  const entry = await prisma.emailOutbox.findUnique({
    where: { id: outboxId },
  });

  if (!entry) return false;

  try {
    const mailer = await getTransporter();
    const info = await mailer.sendMail({
      from: env.SMTP_FROM,
      to: entry.recipientEmail,
      subject: entry.subject,
      html: entry.htmlBody,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📬 [Email Sent] Preview: ${previewUrl}`);
    }

    await prisma.emailOutbox.update({
      where: { id: outboxId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    return true;
  } catch (error: any) {
    console.error(`❌ Failed to send email [${outboxId}] to ${entry.recipientEmail}:`, error.message);

    const nextAttempt = entry.attempts + 1;
    // Exponential backoff: 30s * 2^attempts (30s, 60s, 120s, 240s, 480s)
    const backoffSeconds = Math.min(30 * Math.pow(2, entry.attempts), 3600);
    const nextRetry = new Date(Date.now() + backoffSeconds * 1000);

    await prisma.emailOutbox.update({
      where: { id: outboxId },
      data: {
        status: nextAttempt >= entry.maxAttempts ? 'FAILED' : 'PENDING',
        attempts: nextAttempt,
        nextRetryAt: nextRetry,
        errorLog: error.message || 'Unknown SMTP error',
      },
    });

    return false;
  }
}

// ----------------- EMAIL HTML TEMPLATES -----------------

export function getBookingConfirmationTemplate(params: {
  patientName: string;
  doctorName: string;
  specialization: string;
  date: string;
  time: string;
  urgency: string;
  chiefComplaint: string;
}) {
  return `
  <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="color: #0284c7; margin: 0;">CareSync Healthcare</h2>
      <p style="color: #64748b; margin-top: 4px; font-size: 14px;">Appointment Confirmation & Triage Brief</p>
    </div>
    <p>Dear <strong>${params.patientName}</strong>,</p>
    <p>Your medical appointment with <strong>${params.doctorName}</strong> (${params.specialization}) has been confirmed.</p>
    
    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
      <p style="margin: 4px 0;">📅 <strong>Date:</strong> ${params.date}</p>
      <p style="margin: 4px 0;">⏰ <strong>Time:</strong> ${params.time}</p>
      <p style="margin: 4px 0;">🏥 <strong>Doctor:</strong> ${params.doctorName}</p>
      <p style="margin: 4px 0;">🩺 <strong>Triage Urgency:</strong> <span style="background: ${params.urgency === 'High' ? '#fee2e2; color: #dc2626;' : params.urgency === 'Medium' ? '#fef3c7; color: #d97706;' : '#dcfce7; color: #16a34a;'} padding: 2px 8px; border-radius: 9999px; font-weight: bold;">${params.urgency}</span></p>
      <p style="margin: 4px 0;">📝 <strong>Chief Complaint:</strong> ${params.chiefComplaint}</p>
    </div>

    <p style="font-size: 13px; color: #64748b;">A calendar invite has been scheduled. If you need to reschedule or cancel, please visit your CareSync patient dashboard.</p>
  </div>
  `;
}

export function getDoctorAppointmentNotificationTemplate(params: {
  doctorName: string;
  patientName: string;
  date: string;
  time: string;
  urgency: string;
  chiefComplaint: string;
  suggestedQuestions: string[];
}) {
  const questionsList = params.suggestedQuestions.map((q) => `<li style="margin-bottom: 4px;">${q}</li>`).join('');
  return `
  <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
    <h3 style="color: #0f172a; margin-top: 0;">New Appointment Booked</h3>
    <p>Dr. <strong>${params.doctorName}</strong>,</p>
    <p>A new consultation has been booked with patient <strong>${params.patientName}</strong>.</p>
    
    <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 4px 0;">📅 <strong>Date & Time:</strong> ${params.date} at ${params.time}</p>
      <p style="margin: 4px 0;">⚡ <strong>AI Urgency Assessment:</strong> <strong>${params.urgency}</strong></p>
      <p style="margin: 4px 0;">📋 <strong>Reported Symptoms / Chief Complaint:</strong> ${params.chiefComplaint}</p>
    </div>

    <div style="background: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bfdbfe;">
      <h4 style="color: #1e40af; margin: 0 0 8px 0;">🤖 AI-Suggested Diagnostic Questions:</h4>
      <ul style="color: #1e3a8a; padding-left: 20px; margin: 0;">
        ${questionsList}
      </ul>
    </div>
  </div>
  `;
}

export function getDoctorLeaveAlertTemplate(params: {
  patientName: string;
  doctorName: string;
  date: string;
  reason?: string;
  rescheduleUrl: string;
}) {
  return `
  <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #fca5a5; border-radius: 12px; background: #fffaf0;">
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="color: #dc2626; margin: 0;">⚠️ Schedule Change Notice</h2>
      <p style="color: #7f1d1d; font-size: 14px;">Doctor Leave Notification</p>
    </div>
    <p>Dear <strong>${params.patientName}</strong>,</p>
    <p>We regret to inform you that Dr. <strong>${params.doctorName}</strong> is unexpectedly on leave on <strong>${params.date}</strong>${params.reason ? ` due to <em>${params.reason}</em>` : ''}.</p>
    <p>Your appointment on that date has been safely placed in priority reschedule status so you can choose another preferred slot or physician immediately.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.rescheduleUrl}" style="background: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reschedule Your Visit Now</a>
    </div>

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">We apologize for the inconvenience. For urgent symptoms, please contact clinic emergency services.</p>
  </div>
  `;
}

export function getMedicationReminderTemplate(params: {
  patientName: string;
  medicationName: string;
  dosage: string;
  instructions: string;
  reminderType: string;
}) {
  return `
  <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #bae6fd; border-radius: 12px; background: #f0f9ff;">
    <h3 style="color: #0369a1; margin-top: 0;">💊 Medication Dose Reminder</h3>
    <p>Hello <strong>${params.patientName}</strong>,</p>
    <p>This is your scheduled dose reminder for:</p>
    <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #0284c7;">
      <h4 style="margin: 0 0 8px 0; color: #0f172a;">${params.medicationName}</h4>
      <p style="margin: 4px 0;">📏 <strong>Dosage:</strong> ${params.dosage}</p>
      <p style="margin: 4px 0;">ℹ️ <strong>Instructions:</strong> ${params.instructions || 'Take with water after food.'}</p>
    </div>
    <p style="font-size: 13px; color: #0369a1; margin-top: 16px;">Staying consistent with your prescribed medication ensures optimal recovery!</p>
  </div>
  `;
}

export function getAppointmentCancellationTemplate(params: {
  userName: string;
  doctorName: string;
  date: string;
  time: string;
}) {
  return `
  <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
    <h3 style="color: #475569; margin-top: 0;">Appointment Cancellation</h3>
    <p>Dear <strong>${params.userName}</strong>,</p>
    <p>The appointment scheduled on <strong>${params.date} at ${params.time}</strong> with <strong>${params.doctorName}</strong> has been cancelled.</p>
    <p>If this was not intended, you can re-book any time from your CareSync portal.</p>
  </div>
  `;
}
