import { Controller, Get, Req, UseGuards, Inject } from '@nestjs/common';
import { FollowUpsService } from './follow-ups.service';
import { TenantGuard } from '../tenant/tenant.guard';

@Controller('follow-ups')
@UseGuards(TenantGuard)
export class FollowUpsController {
  constructor(@Inject(FollowUpsService) private readonly followUpsService: FollowUpsService) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.followUpsService.findByClinic(req.clinicId);
  }

  @Get('pending')
  async findPending(@Req() req: any) {
    return this.followUpsService.findPending(req.clinicId);
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    return this.followUpsService.getStats(req.clinicId);
  }
}
