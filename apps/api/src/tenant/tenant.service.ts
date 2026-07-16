import { Injectable } from '@nestjs/common';

@Injectable()
export class TenantService {
  /**
   * Gets the current tenant ID from the request context.
   * clinicId is injected into the request by TenantGuard.
   *
   * Note: Row-Level Security via SET LOCAL was removed because it requires a
   * per-request transaction to work correctly. All services already filter by
   * clinicId explicitly, which provides equivalent isolation.
   */
  getCurrentTenantId(request: any): string | null {
    return request.clinicId || null;
  }
}

