import {
  Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards, Inject,
} from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { TenantGuard } from '../tenant/tenant.guard';
import { createDealSchema, updateDealSchema, updateDealStageSchema, paginationSchema } from '@crm-clinicas/shared';

@Controller('pipeline')
@UseGuards(TenantGuard)
export class PipelineController {
  constructor(@Inject(PipelineService) private readonly pipelineService: PipelineService) {}

  @Get()
  async findAll(@Req() req: any, @Query() query: any) {
    const pagination = paginationSchema.parse(query);
    return this.pipelineService.findAll(req.clinicId, pagination);
  }

  @Get('kanban')
  async kanban(@Req() req: any) {
    return this.pipelineService.findByStage(req.clinicId);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const data = createDealSchema.parse(body);
    return this.pipelineService.create(req.clinicId, data);
  }

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const data = updateDealSchema.parse(body);
    return this.pipelineService.update(req.clinicId, id, data);
  }

  @Put(':id/stage')
  async updateStage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const { stage } = updateDealStageSchema.parse(body);
    return this.pipelineService.updateStage(req.clinicId, id, stage);
  }
}
