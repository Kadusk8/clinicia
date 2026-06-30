import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, Inject,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from './super-admin.guard';

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
    // Return the admin ID as token (simplified)
    return { token: admin.id, name: admin.name, email: admin.email };
  }

  @Post('setup')
  async setup(@Body() body: { email: string; name: string; password: string }) {
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
    return this.adminService.createClinic(body);
  }

  @Put('clinics/:id')
  @UseGuards(SuperAdminGuard)
  async updateClinic(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateClinic(id, body);
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
    return this.adminService.updateAgentConfig(id, body);
  }

  // ==========================================
  // WhatsApp
  // ==========================================

  @Put('clinics/:id/whatsapp')
  @UseGuards(SuperAdminGuard)
  async updateWhatsApp(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateWhatsApp(id, body);
  }
}
