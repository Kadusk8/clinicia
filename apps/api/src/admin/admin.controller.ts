import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, Inject,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  adminCreateClinicSchema,
  adminUpdateClinicSchema,
  adminUpdateAgentSchema,
  adminUpdateWhatsAppSchema,
} from '@crm-clinicas/shared';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from './super-admin.guard';

function signAdminToken(adminId: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET not configured');
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 8; // 8 hours
  const payload = Buffer.from(JSON.stringify({ sub: adminId, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

@Controller('admin')
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  // ==========================================
  // Auth (no guard needed)
  // ==========================================

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }) {
    const admin = await this.adminService.loginSuperAdmin(body.email, body.password);
    if (!admin) {
      return { error: 'Credenciais inválidas' };
    }
    const token = signAdminToken(admin.id);
    return { token, name: admin.name, email: admin.email };
  }

  @Post('setup')
  async setup(@Body() body: { email: string; name: string; password: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Setup endpoint is disabled in production');
    }
    // Only works if no super admin exists yet
    const admin = await this.adminService.createSuperAdmin(body.email, body.name, body.password);
    return { id: admin.id, email: admin.email, name: admin.name };
  }

  // ==========================================
  // Dashboard (protected)
  // ==========================================

  @Get('dashboard')
  @UseGuards(SuperAdminGuard)
  async dashboard() {
    return this.adminService.getDashboardStats();
  }

  // ==========================================
  // Clinics CRUD (protected)
  // ==========================================

  @Get('clinics')
  @UseGuards(SuperAdminGuard)
  async listClinics(@Query('search') search?: string) {
    return this.adminService.listClinics(search);
  }

  @Get('clinics/:id')
  @UseGuards(SuperAdminGuard)
  async getClinic(@Param('id') id: string) {
    return this.adminService.getClinicWithUsers(id);
  }

  @Get('clinics/:id/stats')
  @UseGuards(SuperAdminGuard)
  async getClinicStats(@Param('id') id: string) {
    return this.adminService.getClinicStats(id);
  }

  @Post('clinics')
  @UseGuards(SuperAdminGuard)
  async createClinic(@Body() body: any) {
    const data = adminCreateClinicSchema.parse(body);
    return this.adminService.createClinic(data);
  }

  @Put('clinics/:id')
  @UseGuards(SuperAdminGuard)
  async updateClinic(@Param('id') id: string, @Body() body: any) {
    const data = adminUpdateClinicSchema.parse(body);
    return this.adminService.updateClinic(id, data);
  }

  @Delete('clinics/:id')
  @UseGuards(SuperAdminGuard)
  async deleteClinic(@Param('id') id: string) {
    return this.adminService.deleteClinic(id);
  }

  // ==========================================
  // Suspension
  // ==========================================

  @Put('clinics/:id/suspend')
  @UseGuards(SuperAdminGuard)
  async suspendClinic(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.adminService.suspendClinic(id, body.reason);
  }

  @Put('clinics/:id/reactivate')
  @UseGuards(SuperAdminGuard)
  async reactivateClinic(@Param('id') id: string) {
    return this.adminService.reactivateClinic(id);
  }

  // ==========================================
  // Agent Config
  // ==========================================

  @Put('clinics/:id/agent')
  @UseGuards(SuperAdminGuard)
  async updateAgent(@Param('id') id: string, @Body() body: any) {
    const data = adminUpdateAgentSchema.parse(body);
    return this.adminService.updateAgentConfig(id, data);
  }

  // ==========================================
  // WhatsApp
  // ==========================================

  @Put('clinics/:id/whatsapp')
  @UseGuards(SuperAdminGuard)
  async updateWhatsApp(@Param('id') id: string, @Body() body: any) {
    const data = adminUpdateWhatsAppSchema.parse(body);
    return this.adminService.updateWhatsApp(id, data);
  }
}
