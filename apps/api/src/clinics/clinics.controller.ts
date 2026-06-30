import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { TenantGuard } from '../tenant/tenant.guard';
import { updateClinicSchema } from '@crm-clinicas/shared';

@Controller('clinics')
@UseGuards(TenantGuard)
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get('me')
  async getMe(@Req() req: any) {
    return this.clinicsService.findMe(req.clinicId);
  }

  @Patch('me')
  async updateMe(@Req() req: any, @Body() body: any) {
    const data = updateClinicSchema.partial().parse(body);
    return this.clinicsService.update(req.clinicId, data);
  }
}
