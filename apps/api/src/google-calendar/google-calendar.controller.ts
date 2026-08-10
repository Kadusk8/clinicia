import { Controller, Get, Post, Query, Req, UseGuards, Inject, Redirect } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import { TenantGuard } from '../tenant/tenant.guard';

@Controller('google-calendar')
export class GoogleCalendarController {
  constructor(@Inject(GoogleCalendarService) private readonly googleCalendarService: GoogleCalendarService) {}

  @Get('auth-url')
  @UseGuards(TenantGuard)
  async getAuthUrl(@Req() req: any) {
    return { url: this.googleCalendarService.getAuthUrl(req.clinicId) };
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
  // from the signed `state` param, not from a session cookie (more reliable across
  // cross-site redirect cookie policies).
  @Get('callback')
  @Redirect()
  async callback(@Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (error || !code || !state) {
      return { url: `${appUrl}/settings?google_calendar=error`, statusCode: 302 };
    }

    const result = await this.googleCalendarService.handleCallback(code, state);
    const status = result.success ? 'connected' : 'error';
    return { url: `${appUrl}/settings?google_calendar=${status}`, statusCode: 302 };
  }
}
