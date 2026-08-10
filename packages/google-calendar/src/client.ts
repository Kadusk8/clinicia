import { google } from 'googleapis';
import type { CreateEventParams, UpdateEventParams, BusyInterval, GoogleOAuthTokens } from './types.js';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
];

export class GoogleTokenRevokedError extends Error {
  constructor() {
    super('Google Calendar refresh token is invalid or was revoked');
    this.name = 'GoogleTokenRevokedError';
  }
}

export class GoogleCalendarClient {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
  ) {}

  private newOAuthClient() {
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
  }

  getAuthUrl(state: string): string {
    const oauth2Client = this.newOAuthClient();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state,
    });
  }

  async exchangeCode(code: string): Promise<GoogleOAuthTokens> {
    const oauth2Client = this.newOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.access_token) {
      throw new Error('Google did not return an access token');
    }
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date ?? null,
    };
  }

  private authorizedClient(refreshToken: string) {
    const oauth2Client = this.newOAuthClient();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  private async withErrorMapping<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const err = error as { response?: { status?: number }; message?: string };
      if (
        err.response?.status === 401 ||
        err.response?.status === 400 ||
        /invalid_grant/i.test(err.message ?? '')
      ) {
        throw new GoogleTokenRevokedError();
      }
      throw error;
    }
  }

  async getConnectedEmail(refreshToken: string): Promise<string | null> {
    return this.withErrorMapping(async () => {
      const auth = this.authorizedClient(refreshToken);
      const oauth2 = google.oauth2({ version: 'v2', auth });
      const { data } = await oauth2.userinfo.get();
      return data.email ?? null;
    });
  }

  async createEvent(refreshToken: string, calendarId: string, params: CreateEventParams): Promise<string> {
    return this.withErrorMapping(async () => {
      const auth = this.authorizedClient(refreshToken);
      const calendar = google.calendar({ version: 'v3', auth });
      const { data } = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: params.summary,
          description: params.description,
          start: { dateTime: params.startISO, timeZone: params.timeZone },
          end: { dateTime: params.endISO, timeZone: params.timeZone },
        },
      });
      if (!data.id) throw new Error('Google Calendar did not return an event id');
      return data.id;
    });
  }

  async updateEvent(
    refreshToken: string,
    calendarId: string,
    eventId: string,
    params: UpdateEventParams,
  ): Promise<void> {
    return this.withErrorMapping(async () => {
      const auth = this.authorizedClient(refreshToken);
      const calendar = google.calendar({ version: 'v3', auth });
      await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: {
          summary: params.summary,
          description: params.description,
          start: { dateTime: params.startISO, timeZone: params.timeZone },
          end: { dateTime: params.endISO, timeZone: params.timeZone },
        },
      });
    });
  }

  async deleteEvent(refreshToken: string, calendarId: string, eventId: string): Promise<void> {
    return this.withErrorMapping(async () => {
      const auth = this.authorizedClient(refreshToken);
      const calendar = google.calendar({ version: 'v3', auth });
      try {
        await calendar.events.delete({ calendarId, eventId });
      } catch (error) {
        const err = error as { response?: { status?: number } };
        // Already deleted on the Google side — nothing to do.
        if (err.response?.status === 404 || err.response?.status === 410) return;
        throw error;
      }
    });
  }

  async getFreeBusy(
    refreshToken: string,
    calendarId: string,
    timeMinISO: string,
    timeMaxISO: string,
  ): Promise<BusyInterval[]> {
    return this.withErrorMapping(async () => {
      const auth = this.authorizedClient(refreshToken);
      const calendar = google.calendar({ version: 'v3', auth });
      const { data } = await calendar.freebusy.query({
        requestBody: {
          timeMin: timeMinISO,
          timeMax: timeMaxISO,
          items: [{ id: calendarId }],
        },
      });
      const busy = data.calendars?.[calendarId]?.busy ?? [];
      return busy
        .filter((b): b is { start: string; end: string } => !!b.start && !!b.end)
        .map((b) => ({ start: b.start, end: b.end }));
    });
  }
}
