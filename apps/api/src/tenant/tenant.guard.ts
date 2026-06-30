import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { db, schema } from '@crm-clinicas/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // clinicId comes from the authenticated user's session
    const clinicId = request.user?.clinicId;

    if (!clinicId) {
      throw new UnauthorizedException('Tenant não identificado');
    }

    // Check clinic is active (not suspended)
    const [clinic] = await db
      .select({ active: schema.clinics.active })
      .from(schema.clinics)
      .where(eq(schema.clinics.id, clinicId))
      .limit(1);

    if (!clinic) {
      throw new UnauthorizedException('Clínica não encontrada');
    }

    if (clinic.active === false) {
      throw new ForbiddenException('Clínica suspensa. Entre em contato com o suporte.');
    }

    // Inject clinicId into the request for downstream use
    request.clinicId = clinicId;

    // Set RLS context
    await this.tenantService.setTenantContext(clinicId);

    return true;
  }
}
