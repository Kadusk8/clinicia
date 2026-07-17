import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { TenantGuard } from '../tenant/tenant.guard';
import { createPatientSchema, updatePatientSchema, paginationSchema } from '@crm-clinicas/shared';

@Controller('patients')
@UseGuards(TenantGuard)
export class PatientsController {
  constructor(@Inject(PatientsService) private readonly patientsService: PatientsService) {}

  @Get()
  async findAll(@Req() req: any, @Query() query: any) {
    const clinicId = req.clinicId;
    const pagination = paginationSchema.parse(query);
    return this.patientsService.findAll(clinicId, pagination);
  }

  @Get(':id')
  async findById(@Req() req: any, @Param('id') id: string) {
    return this.patientsService.findById(req.clinicId, id);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const data = createPatientSchema.parse(body);
    return this.patientsService.create(req.clinicId, data);
  }

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const data = updatePatientSchema.parse(body);
    return this.patientsService.update(req.clinicId, id, data);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.patientsService.delete(req.clinicId, id);
  }
}
