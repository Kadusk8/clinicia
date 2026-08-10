import { db, schema } from '@crm-clinicas/db';
import { eq } from 'drizzle-orm';
import { GoogleCalendarClient, GoogleTokenRevokedError, type BusyInterval } from '@crm-clinicas/google-calendar';

function getClient(): GoogleCalendarClient | null {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return new GoogleCalendarClient(clientId, clientSecret, redirectUri);
}

async function getClinicGoogleConfig(clinicId: string) {
  const [clinic] = await db
    .select({
      googleRefreshToken: schema.clinics.googleRefreshToken,
      googleCalendarId: schema.clinics.googleCalendarId,
      timezone: schema.clinics.timezone,
    })
    .from(schema.clinics)
    .where(eq(schema.clinics.id, clinicId))
    .limit(1);

  if (!clinic?.googleRefreshToken || !clinic.googleCalendarId) return null;
  return {
    refreshToken: clinic.googleRefreshToken,
    calendarId: clinic.googleCalendarId,
    timezone: clinic.timezone ?? 'America/Sao_Paulo',
  };
}

async function disconnectOnRevocation(clinicId: string) {
  await db
    .update(schema.clinics)
    .set({ googleRefreshToken: null, googleCalendarId: null, googleCalendarEmail: null, googleCalendarConnectedAt: null })
    .where(eq(schema.clinics.id, clinicId));
}

/** Best-effort: returns busy intervals from the clinic's Google Calendar, or [] if not connected/on error. */
export async function getGoogleBusyIntervals(
  clinicId: string,
  fromISO: string,
  toISO: string,
): Promise<BusyInterval[]> {
  const client = getClient();
  if (!client) return [];

  const config = await getClinicGoogleConfig(clinicId);
  if (!config) return [];

  try {
    return await client.getFreeBusy(config.refreshToken, config.calendarId, fromISO, toISO);
  } catch (error) {
    if (error instanceof GoogleTokenRevokedError) {
      await disconnectOnRevocation(clinicId);
    }
    return [];
  }
}

/** Best-effort: creates a Google Calendar event for the appointment and stores its id. Never throws. */
export async function pushAppointmentToGoogle(
  clinicId: string,
  appointment: { id: string; startsAt: Date; endsAt: Date },
  summary: string,
  description?: string,
): Promise<void> {
  const client = getClient();
  if (!client) return;

  const config = await getClinicGoogleConfig(clinicId);
  if (!config) return;

  try {
    const eventId = await client.createEvent(config.refreshToken, config.calendarId, {
      summary,
      description,
      startISO: appointment.startsAt.toISOString(),
      endISO: appointment.endsAt.toISOString(),
      timeZone: config.timezone,
    });
    await db
      .update(schema.appointments)
      .set({ googleEventId: eventId })
      .where(eq(schema.appointments.id, appointment.id));
  } catch (error) {
    if (error instanceof GoogleTokenRevokedError) {
      await disconnectOnRevocation(clinicId);
    }
    // Non-blocking: appointment stays valid in the CRM even if Google push fails.
  }
}

/** Best-effort: updates the Google Calendar event tied to this appointment, if one exists. Never throws. */
export async function updateAppointmentInGoogle(
  clinicId: string,
  appointment: { googleEventId: string | null; startsAt: Date; endsAt: Date },
  summary: string,
  description?: string,
): Promise<void> {
  if (!appointment.googleEventId) return;
  const client = getClient();
  if (!client) return;

  const config = await getClinicGoogleConfig(clinicId);
  if (!config) return;

  try {
    await client.updateEvent(config.refreshToken, config.calendarId, appointment.googleEventId, {
      summary,
      description,
      startISO: appointment.startsAt.toISOString(),
      endISO: appointment.endsAt.toISOString(),
      timeZone: config.timezone,
    });
  } catch (error) {
    if (error instanceof GoogleTokenRevokedError) {
      await disconnectOnRevocation(clinicId);
    }
  }
}

/** Best-effort: deletes the Google Calendar event tied to this appointment, if one exists. Never throws. */
export async function removeAppointmentFromGoogle(
  clinicId: string,
  appointment: { googleEventId: string | null },
): Promise<void> {
  if (!appointment.googleEventId) return;
  const client = getClient();
  if (!client) return;

  const config = await getClinicGoogleConfig(clinicId);
  if (!config) return;

  try {
    await client.deleteEvent(config.refreshToken, config.calendarId, appointment.googleEventId);
  } catch (error) {
    if (error instanceof GoogleTokenRevokedError) {
      await disconnectOnRevocation(clinicId);
    }
  }
}
