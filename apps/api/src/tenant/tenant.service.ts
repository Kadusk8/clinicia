import { Injectable } from '@nestjs/common';
import { db } from '@crm-clinicas/db';
import { sql } from 'drizzle-orm';

@Injectable()
export class TenantService {
  /**
   * Sets the current tenant context for RLS.
   * Must be called at the beginning of each request/transaction.
   */
  async setTenantContext(clinicId: string): Promise<void> {
    await db.execute(sql`SET LOCAL app.current_clinic_id = ${clinicId}`);
  }

  /**
   * Gets the current tenant ID from the request context.
   */
  getCurrentTenantId(request: any): string | null {
    // clinicId is injected by the TenantGuard into the request
    return request.clinicId || null;
  }
}
