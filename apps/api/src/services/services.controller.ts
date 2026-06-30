import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { TenantGuard } from '../tenant/tenant.guard';
import { createServiceSchema, updateServiceSchema, paginationSchema } from '@crm-clinicas/shared';

@Controller('services')
@UseGuards(TenantGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async findAll(@Req() req: any, @Query() query: any) {
    const pagination = paginationSchema.parse(query);
    return this.servicesService.findAll(req.clinicId, pagination);
  }

  @Get(':id')
  async findById(@Req() req: any, @Param('id') id: string) {
    return this.servicesService.findById(req.clinicId, id);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const data = createServiceSchema.parse(body);
    return this.servicesService.create(req.clinicId, data);
  }

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const data = updateServiceSchema.parse(body);
    return this.servicesService.update(req.clinicId, id, data);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.servicesService.delete(req.clinicId, id);
  }
}
