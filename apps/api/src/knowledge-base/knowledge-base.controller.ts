import {
  Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards, Inject,
} from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { TenantGuard } from '../tenant/tenant.guard';
import { createKnowledgeBaseDocSchema } from '@crm-clinicas/shared';

@Controller('knowledge-base')
@UseGuards(TenantGuard)
export class KnowledgeBaseController {
  constructor(
    @Inject(KnowledgeBaseService) private readonly kbService: KnowledgeBaseService,
  ) {}

  @Get()
  async findAll(@Req() req: any, @Query('categoryKey') categoryKey?: string) {
    return this.kbService.findAll(req.clinicId, categoryKey);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const { title, content, categoryKey } = createKnowledgeBaseDocSchema.parse(body);
    return this.kbService.create(req.clinicId, title, content, 'upload', categoryKey);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    await this.kbService.delete(req.clinicId, id);
    return { success: true };
  }
}
