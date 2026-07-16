import { Controller, Post, Body, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import { BillingService } from './billing.service';

@SkipThrottle()
@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billingService: BillingService) {}

  /**
   * Asaas webhook endpoint.
   * Asaas sends the access token in the `asaas-access-token` header.
   */
  @Post('webhook')
  async handleWebhook(
    @Headers('asaas-access-token') token: string,
    @Body() body: any,
  ) {
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;

    if (!expectedToken) {
      throw new UnauthorizedException('ASAAS_WEBHOOK_TOKEN not configured');
    }

    // Timing-safe comparison to prevent timing attacks
    const incoming = Buffer.from(token || '');
    const expected = Buffer.from(expectedToken);
    if (incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) {
      throw new UnauthorizedException('Invalid webhook token');
    }

    const event = body?.event as string | undefined;
    const externalReference = body?.payment?.externalReference as string | undefined;

    if (!externalReference) {
      this.logger.warn(`Webhook ${event} missing externalReference — ignoring`);
      return { received: true };
    }

    this.logger.log(`Asaas webhook: ${event} for ${externalReference}`);

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        await this.billingService.handlePaymentReceived(externalReference);
        break;

      case 'PAYMENT_OVERDUE':
        await this.billingService.handlePaymentOverdue(externalReference);
        break;

      case 'PAYMENT_DELETED':
      case 'SUBSCRIPTION_CANCELLED':
        await this.billingService.handleSubscriptionCancelled(externalReference);
        break;

      default:
        this.logger.log(`Unhandled Asaas event: ${event}`);
    }

    return { received: true };
  }
}
