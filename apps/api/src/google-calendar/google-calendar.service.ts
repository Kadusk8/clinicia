import { Injectable, Logger } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq } from 'drizzle-orm';
import { createHmac } from 'crypto';
import { GoogleCalendarClient } from '@crm-clinicas/google-calendar';

const STATE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  private getClient(): GoogleCalendarClient {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google Calendar integration is not configured (missing env vars)');
    }
    return new GoogleCalendarClient(clientId, clientSecret, redirectUri);
  }

  private stateSecret(): string {
    return process.env.BETTER_AUTH_SECRET || 'secret-key-for-dev-only';
  }

  private signState(clinicId: string, nonce: string): string {
    const payload = Buffer.from(JSON.stringify({ clinicId, nonce, ts: Date.now() })).toString('base64url');
    const sig = createHmac('sha256', this.stateSecret()).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  private verifyState(state: string): { clinicId: string; nonce: string } {
    const [payload, sig] = state.split('.');
    if (!payload || !sig) throw new Error('Invalid state format');

    const expectedSig = createHmac('sha256', this.stateSecret()).update(payload).digest('base64url');
    if (sig !== expectedSig) throw new Error('Invalid state signature');

    const { clinicId, nonce, ts } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      clinicId: string;
      nonce: string;
      ts: number;
    };
    if (Date.now() - ts > STATE_TTL_MS) throw new Error('State expired');
    return { clinicId, nonce };
  }

  getAuthUrl(clinicId: string, nonce: string): string {
    const client = this.getClient();
    return client.getAuthUrl(this.signState(clinicId, nonce));
  }

  async handleCallback(
    code: string,
    state: string,
    cookieNonce: string,
  ): Promise<{ success: boolean; error?: string }> {
    let clinicId: string;
    try {
      const parsed = this.verifyState(state);
      // Binds this callback to the same browser that requested the auth URL — without
      // this, a signed-but-unbound state could be harvested by an attacker (via their
      // own legitimate auth-url call) and replayed by tricking a different user into
      // completing the consent screen, linking the victim's calendar to the attacker's
      // clinic.
      if (parsed.nonce !== cookieNonce) throw new Error('Nonce mismatch');
      clinicId = parsed.clinicId;
    } catch (error) {
      this.logger.warn(`Invalid Google OAuth state: ${error instanceof Error ? error.message : error}`);
      return { success: false, error: 'invalid_state' };
    }

    try {
      const client = this.getClient();
      const tokens = await client.exchangeCode(code);
      if (!tokens.refreshToken) {
        this.logger.warn(`No refresh token returned for clinic ${clinicId}`);
        return { success: false, error: 'no_refresh_token' };
      }

      const email = await client.getConnectedEmail(tokens.refreshToken);

      await db
        .update(schema.clinics)
        .set({
          googleRefreshToken: tokens.refreshToken,
          googleCalendarId: 'primary',
          googleCalendarEmail: email,
          googleCalendarConnectedAt: new Date(),
        })
        .where(eq(schema.clinics.id, clinicId));

      return { success: true };
    } catch (error) {
      this.logger.error(`Google Calendar OAuth exchange failed: ${error instanceof Error ? error.message : error}`);
      return { success: false, error: 'exchange_failed' };
    }
  }

  async disconnect(clinicId: string): Promise<void> {
    await db
      .update(schema.clinics)
      .set({
        googleRefreshToken: null,
        googleCalendarId: null,
        googleCalendarEmail: null,
        googleCalendarConnectedAt: null,
      })
      .where(eq(schema.clinics.id, clinicId));
  }

  async getStatus(clinicId: string): Promise<{ connected: boolean; email: string | null }> {
    const [clinic] = await db
      .select({
        googleRefreshToken: schema.clinics.googleRefreshToken,
        googleCalendarEmail: schema.clinics.googleCalendarEmail,
      })
      .from(schema.clinics)
      .where(eq(schema.clinics.id, clinicId))
      .limit(1);

    return { connected: !!clinic?.googleRefreshToken, email: clinic?.googleCalendarEmail ?? null };
  }
}
