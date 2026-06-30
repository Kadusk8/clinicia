import {
  Controller, Get, Post, Put, Param, Query, Body, Req, UseGuards,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { TenantGuard } from '../tenant/tenant.guard';
import { paginationSchema, sendMessageSchema } from '@crm-clinicas/shared';

@Controller('conversations')
@UseGuards(TenantGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async findAll(@Req() req: any, @Query() query: any) {
    const pagination = paginationSchema.parse(query);
    return this.conversationsService.findAll(req.clinicId, pagination);
  }

  @Get(':id')
  async findById(@Req() req: any, @Param('id') id: string) {
    return this.conversationsService.findById(req.clinicId, id);
  }

  @Get(':id/messages')
  async getMessages(@Req() req: any, @Param('id') id: string) {
    return this.conversationsService.getMessages(id, req.clinicId);
  }

  @Post(':id/messages')
  async sendMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const data = sendMessageSchema.parse(body);
    return this.conversationsService.sendStaffMessage(req.clinicId, id, data.content);
  }

  @Put(':id/takeover')
  async takeover(@Req() req: any, @Param('id') id: string) {
    return this.conversationsService.takeover(req.clinicId, id, req.user.id);
  }

  @Put(':id/return-to-agent')
  async returnToAgent(@Req() req: any, @Param('id') id: string) {
    return this.conversationsService.returnToAgent(req.clinicId, id);
  }

  @Put(':id/read')
  async markAsRead(@Req() req: any, @Param('id') id: string): Promise<void> {
    await this.conversationsService.markAsRead(req.clinicId, id);
  }
}
