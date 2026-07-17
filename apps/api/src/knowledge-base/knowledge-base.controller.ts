import {
  Controller, Get, Post, Delete, Body, Param, Req, UseGuards, Inject,
} from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { TenantGuard } from '../tenant/tenant.guard';
import { Queue } from 'bullmq';
import { createKnowledgeBaseDocSchema } from '@crm-clinicas/shared';

@Controller('knowledge-base')
@UseGuards(TenantGuard)
export class KnowledgeBaseController {
  constructor(
    @Inject(KnowledgeBaseService) private readonly kbService: KnowledgeBaseService,
    @Inject('EMBEDDING_QUEUE') private readonly embeddingQueue: Queue,
  ) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.kbService.findAll(req.clinicId);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const { title, content } = createKnowledgeBaseDocSchema.parse(body);

    const doc = await this.kbService.create(req.clinicId, title, content);

    // Enqueue embedding generation
    await this.embeddingQueue.add(
      'embed',
      { documentId: doc.id, clinicId: req.clinicId },
      { jobId: `embed-${doc.id}`, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return doc;
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    await this.kbService.delete(req.clinicId, id);
    return { success: true };
  }
}
