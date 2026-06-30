import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { TenantGuard } from '../tenant/tenant.guard';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  paginationSchema,
} from '@crm-clinicas/shared';

@Controller('appointments')
@UseGuards(TenantGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  async findAll(@Req() req: any, @Query() query: any) {
    const pagination = paginationSchema.parse(query);
    return this.appointmentsService.findAll(req.clinicId, pagination);
  }

  @Get('range')
  async findByRange(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.appointmentsService.findByDateRange(
      req.clinicId,
      new Date(from),
      new Date(to),
    );
  }

  @Get(':id')
  async findById(@Req() req: any, @Param('id') id: string) {
    return this.appointmentsService.findById(req.clinicId, id);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const data = createAppointmentSchema.parse(body);
    return this.appointmentsService.create(req.clinicId, data as any);
  }

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const data = updateAppointmentSchema.parse(body);
    return this.appointmentsService.update(req.clinicId, id, data as any);
  }

  @Put(':id/cancel')
  async cancel(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.appointmentsService.cancel(req.clinicId, id, body.reason);
  }
}
