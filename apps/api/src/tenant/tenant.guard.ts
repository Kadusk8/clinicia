import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // clinicId comes from the authenticated user's session
    // (populated by AuthMiddleware from Better Auth cookie)
    const clinicId = request.user?.clinicId;
    this.logger.warn(`TenantGuard check: hasUser=${!!request.user} clinicId=${clinicId} url=${request.url} reqCtor=${request.constructor?.name}`);

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

    return true;
  }
}

