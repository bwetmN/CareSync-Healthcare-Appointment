import { google } from 'googleapis';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';

/**
 * Creates Google OAuth2 Client
 */
export function getOAuth2Client() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return null;
  }

  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate Google OAuth2 Authorization URL
 */
export function getGoogleAuthUrl(userId: string): string | null {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return null;

  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: userId,
    prompt: 'consent',
  });
}

/**
 * Exchange OAuth authorization code for tokens
 */
export async function handleGoogleCallback(code: string, userId: string): Promise<boolean> {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return false;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (tokens.refresh_token) {
      await prisma.user.update({
        where: { id: userId },
        data: { googleRefreshToken: tokens.refresh_token },
      });
    }
    return true;
  } catch (error) {
    console.error('❌ Failed to exchange Google OAuth code:', error);
    return false;
  }
}

/**
 * Helper to build ISO date-time string from YYYY-MM-DD and HH:mm
 */
function buildIsoDateTime(date: string, time: string): string {
  // Use local or UTC format: YYYY-MM-DDTHH:mm:00
  return `${date}T${time}:00`;
}

/**
 * Create Google Calendar Event for an Appointment
 */
export async function createCalendarEvent(appointmentId: string): Promise<string | null> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: true,
      doctor: {
        include: { user: true },
      },
    },
  });

  if (!appt) return null;

  const oauth2Client = getOAuth2Client();

  // If no OAuth credentials or tokens configured, mock the event ID cleanly
  if (!oauth2Client) {
    const mockEventId = `mock_cal_event_${Date.now()}_${appointmentId.substring(0, 8)}`;
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { googleCalendarEventId: mockEventId },
    });
    console.log(`📅 [Google Calendar Mock] Created event ${mockEventId} for appointment ${appointmentId}`);
    return mockEventId;
  }

  // Attempt using patient or doctor's refresh token if present
  const userWithToken = appt.patient.googleRefreshToken ? appt.patient : appt.doctor.user.googleRefreshToken ? appt.doctor.user : null;

  if (!userWithToken || !userWithToken.googleRefreshToken) {
    const mockEventId = `mock_cal_event_${Date.now()}_${appointmentId.substring(0, 8)}`;
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { googleCalendarEventId: mockEventId },
    });
    return mockEventId;
  }

  try {
    oauth2Client.setCredentials({ refresh_token: userWithToken.googleRefreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary: `Medical Consultation: Dr. ${appt.doctor.user.name} & ${appt.patient.name}`,
      description: `Appointment details:\nDoctor: Dr. ${appt.doctor.user.name} (${appt.doctor.specialization})\nPatient: ${appt.patient.name}\nTriage Urgency: ${appt.preVisitUrgency || 'Standard'}\nChief Complaint: ${appt.preVisitSummary || appt.symptoms}`,
      start: {
        dateTime: buildIsoDateTime(appt.appointmentDate, appt.startTime),
        timeZone: 'UTC',
      },
      end: {
        dateTime: buildIsoDateTime(appt.appointmentDate, appt.endTime),
        timeZone: 'UTC',
      },
      attendees: [
        { email: appt.patient.email, displayName: appt.patient.name },
        { email: appt.doctor.user.email, displayName: `Dr. ${appt.doctor.user.name}` },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    const eventId = res.data.id || null;
    if (eventId) {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { googleCalendarEventId: eventId },
      });
    }

    return eventId;
  } catch (error: any) {
    console.error('⚠️ Google Calendar event creation fallback:', error.message);
    const mockEventId = `mock_cal_event_${Date.now()}_${appointmentId.substring(0, 8)}`;
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { googleCalendarEventId: mockEventId },
    });
    return mockEventId;
  }
}

/**
 * Update Google Calendar Event on Reschedule
 */
export async function updateCalendarEvent(
  appointmentId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string
): Promise<boolean> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, doctor: { include: { user: true } } },
  });

  if (!appt || !appt.googleCalendarEventId) return false;

  // If mock event, simply log update
  if (appt.googleCalendarEventId.startsWith('mock_')) {
    console.log(`📅 [Google Calendar Mock] Rescheduled event ${appt.googleCalendarEventId} to ${newDate} ${newStartTime}-${newEndTime}`);
    return true;
  }

  const oauth2Client = getOAuth2Client();
  const userWithToken = appt.patient.googleRefreshToken ? appt.patient : appt.doctor.user.googleRefreshToken ? appt.doctor.user : null;

  if (!oauth2Client || !userWithToken || !userWithToken.googleRefreshToken) {
    return true;
  }

  try {
    oauth2Client.setCredentials({ refresh_token: userWithToken.googleRefreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.patch({
      calendarId: 'primary',
      eventId: appt.googleCalendarEventId,
      requestBody: {
        start: {
          dateTime: buildIsoDateTime(newDate, newStartTime),
          timeZone: 'UTC',
        },
        end: {
          dateTime: buildIsoDateTime(newDate, newEndTime),
          timeZone: 'UTC',
        },
      },
    });

    return true;
  } catch (error: any) {
    console.error('⚠️ Google Calendar patch fallback:', error.message);
    return false;
  }
}

/**
 * Delete Google Calendar Event on Cancellation
 */
export async function deleteCalendarEvent(appointmentId: string): Promise<boolean> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, doctor: { include: { user: true } } },
  });

  if (!appt || !appt.googleCalendarEventId) return false;

  if (appt.googleCalendarEventId.startsWith('mock_')) {
    console.log(`📅 [Google Calendar Mock] Deleted event ${appt.googleCalendarEventId}`);
    return true;
  }

  const oauth2Client = getOAuth2Client();
  const userWithToken = appt.patient.googleRefreshToken ? appt.patient : appt.doctor.user.googleRefreshToken ? appt.doctor.user : null;

  if (!oauth2Client || !userWithToken || !userWithToken.googleRefreshToken) {
    return true;
  }

  try {
    oauth2Client.setCredentials({ refresh_token: userWithToken.googleRefreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: appt.googleCalendarEventId,
    });

    return true;
  } catch (error: any) {
    console.error('⚠️ Google Calendar delete fallback:', error.message);
    return false;
  }
}
