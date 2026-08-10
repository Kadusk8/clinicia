import { Controller, Get, Post, Query, Req, Res, UseGuards, Inject, Redirect } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'crypto';
import { GoogleCalendarService } from './google-calendar.service';
import { TenantGuard } from '../tenant/tenant.guard';

const NONCE_COOKIE = 'gcal_oauth_nonce';
const COOKIE_PATH = '/api/google-calendar';

@Controller('google-calendar')
export class GoogleCalendarController {
  constructor(@Inject(GoogleCalendarService) private readonly googleCalendarService: GoogleCalendarService) {}

  // The nonce cookie binds the OAuth `state` to the browser that started the flow —
  // without it, anyone could request an auth URL for their own clinic and trick a
  // different user into completing it, linking the victim's Google Calendar to the
  // attacker's clinic. See handleCallback().
  @Get('auth-url')
  @UseGuards(TenantGuard)
  async getAuthUrl(@Req() req: any, @Res({ passthrough: true }) reply: FastifyReply) {
    const nonce = randomBytes(24).toString('base64url');
    reply.header('Set-Cookie', this.buildCookie(nonce, 600));
    return { url: this.googleCalendarService.getAuthUrl(req.clinicId, nonce) };
  }

  @Get('status')
  @UseGuards(TenantGuard)
  async getStatus(@Req() req: any) {
    return this.googleCalendarService.getStatus(req.clinicId);
  }

  @Post('disconnect')
  @UseGuards(TenantGuard)
  async disconnect(@Req() req: any) {
    await this.googleCalendarService.disconnect(req.clinicId);
    return { success: true };
  }

  // Public: Google redirects the browser here after consent. Clinic identity comes
  // from the signed `state` param (not a session cookie, more reliable across
  // cross-site redirect cookie policies), but state alone only proves it wasn't
  // tampered with — it doesn't prove this browser is the one that started the flow.
  // The nonce cookie set in getAuthUrl() provides that binding.
  @Get('callback')
  @Redirect()
  async callback(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const cookieNonce = this.readCookie(req, NONCE_COOKIE);
    reply.header('Set-Cookie', this.buildCookie('', 0)); // clear it, one-time use

    if (error || !code || !state || !cookieNonce) {
      return { url: `${appUrl}/settings?google_calendar=error`, statusCode: 302 };
    }

    const result = await this.googleCalendarService.handleCallback(code, state, cookieNonce);
    const status = result.success ? 'connected' : 'error';
    return { url: `${appUrl}/settings?google_calendar=${status}`, statusCode: 302 };
  }

  private buildCookie(value: string, maxAgeSeconds: number): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${NONCE_COOKIE}=${value}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
  }

  private readCookie(req: FastifyRequest, name: string): string | null {
    const header = req.headers['cookie'];
    if (!header) return null;
    const match = header
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
  }
}
