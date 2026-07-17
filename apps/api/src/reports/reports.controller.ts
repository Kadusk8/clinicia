import { Controller, Get, Query, Req, Res, UseGuards, Inject } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { TenantGuard } from '../tenant/tenant.guard';

@Controller('reports')
@UseGuards(TenantGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get('overview')
  async getOverview(@Req() req: any) {
    return this.reportsService.getOverview(req.clinicId);
  }

  @Get('appointments')
  async getAppointmentsReport(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from ? new Date(from) : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
    const toDate = to ? new Date(to) : new Date();
    return this.reportsService.getAppointmentsReport(req.clinicId, fromDate, toDate);
  }

  @Get('conversations')
  async getConversationsReport(@Req() req: any) {
    return this.reportsService.getConversationsReport(req.clinicId);
  }

  @Get('export/appointments')
  async exportAppointments(
    @Req() req: any,
    @Res() res: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from ? new Date(from) : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
    const toDate = to ? new Date(to) : new Date();
    const csv = await this.reportsService.exportAppointmentsCsv(req.clinicId, fromDate, toDate);

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="consultas.csv"');
    res.send('\uFEFF' + csv); // BOM for Excel compatibility
  }
}
