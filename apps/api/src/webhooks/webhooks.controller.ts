import { Controller, Post, Param, Body, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import * as crypto from 'crypto';
import { WebhooksService } from './webhooks.service';

@SkipThrottle()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('evolution/:instanceName')
  async evolutionWebhook(
    @Param('instanceName') instanceName: string,
    @Headers('apikey') apikey: string | undefined,
    @Body() body: any,
  ) {
    this.logger.log(`Evolution webhook received for instance: ${instanceName}`);

    const clinicApiKey = await this.webhooksService.getClinicApiKey(instanceName);

    if (!clinicApiKey) {
      // Instance not found — reject silently to avoid enumeration
      throw new UnauthorizedException('Unauthorized');
    }

    // Evolution Go sends the instance token either as an `apikey` header
    // or as `instanceToken` in the body, depending on delivery path — accept either.
    const providedToken = apikey || (body && typeof body === 'object' ? body.instanceToken : undefined);

    if (!providedToken) {
      throw new UnauthorizedException('Missing instance token');
    }

    const incoming = Buffer.from(providedToken);
    const expected = Buffer.from(clinicApiKey);
    if (incoming.length !== expected.length || !crypto.timingSafeEqual(incoming, expected)) {
      throw new UnauthorizedException('Invalid instance token');
    }

    // Basic body validation
    if (!body || typeof body !== 'object') {
      this.logger.warn(`Invalid webhook body from instance: ${instanceName}`);
      return { received: true };
    }

    await this.webhooksService.processEvolutionWebhook(instanceName, body);

    return { received: true };
  }
}
