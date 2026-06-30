import { Injectable } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class BillingService {
  /**
   * Called when Asaas reports a successful payment.
   * Activates the clinic and clears suspension if any.
   */
  async handlePaymentReceived(externalReference: string) {
    // externalReference is the clinicId set when creating the charge
    await db
      .update(schema.clinics)
      .set({
        active: true,
        suspendedAt: null,
        suspendedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.clinics.id, externalReference));

    console.log(`✅ Billing: payment received for clinic ${externalReference}`);
  }

  /**
   * Called when a payment is overdue. Suspends the clinic.
   */
  async handlePaymentOverdue(externalReference: string) {
    await db
      .update(schema.clinics)
      .set({
        active: false,
        suspendedAt: new Date(),
        suspendedReason: 'Pagamento em atraso',
        updatedAt: new Date(),
      })
      .where(eq(schema.clinics.id, externalReference));

    console.log(`⚠️ Billing: payment overdue for clinic ${externalReference}`);
  }

  /**
   * Called when a subscription is cancelled.
   */
  async handleSubscriptionCancelled(externalReference: string) {
    await db
      .update(schema.clinics)
      .set({
        active: false,
        suspendedAt: new Date(),
        suspendedReason: 'Assinatura cancelada',
        updatedAt: new Date(),
      })
      .where(eq(schema.clinics.id, externalReference));

    console.log(`❌ Billing: subscription cancelled for clinic ${externalReference}`);
  }
}
