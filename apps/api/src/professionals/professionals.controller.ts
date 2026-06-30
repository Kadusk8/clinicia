import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { TenantGuard } from '../tenant/tenant.guard';
import {
  createProfessionalSchema,
  updateProfessionalSchema,
  paginationSchema,
} from '@crm-clinicas/shared';

@Controller('professionals')
@UseGuards(TenantGuard)
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  @Get()
  async findAll(@Req() req: any, @Query() query: any) {
    const pagination = paginationSchema.parse(query);
    return this.professionalsService.findAll(req.clinicId, pagination);
  }

  @Get(':id')
  async findById(@Req() req: any, @Param('id') id: string) {
    return this.professionalsService.findById(req.clinicId, id);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const data = createProfessionalSchema.parse(body);
    return this.professionalsService.create(req.clinicId, data);
  }

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const data = updateProfessionalSchema.parse(body);
    return this.professionalsService.update(req.clinicId, id, data);
  }

  @Patch(':id/working-hours')
  async updateWorkingHours(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const data = updateProfessionalSchema.parse({ workingHours: body.workingHours });
    return this.professionalsService.update(req.clinicId, id, data as any);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.professionalsService.delete(req.clinicId, id);
  }
}
