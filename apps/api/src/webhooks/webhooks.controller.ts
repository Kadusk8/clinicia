import { Controller, Post, Param, Body, Logger } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('evolution/:instanceName')
  async evolutionWebhook(
    @Param('instanceName') instanceName: string,
    @Body() body: any,
  ) {
    this.logger.log(`Evolution webhook received for instance: ${instanceName}`);

    // TODO: Validate webhook signature/apikey

    await this.webhooksService.processEvolutionWebhook(instanceName, body);

    return { received: true };
  }
}
