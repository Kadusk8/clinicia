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
import { auth } from '../auth/better-auth';

/**
 * Validates the Better Auth session cookie and enforces tenant isolation.
 *
 * This used to be split into an AuthMiddleware (NestMiddleware) that set
 * request.user, plus this guard reading it. On Fastify, NestMiddleware runs
 * through an Express-compatibility shim operating on the raw Node
 * IncomingMessage — a different object from the FastifyRequest instance
 * guards/controllers receive via context.switchToHttp().getRequest(). So
 * request.user set by the middleware never reached this guard. Doing the
 * session lookup directly here (same pattern as SuperAdminGuard) guarantees
 * we're reading/writing the same request object the rest of the pipeline sees.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const user = await this.resolveUser(request);
    if (!user) {
      throw new UnauthorizedException('Tenant não identificado');
    }
    request.user = user;

    const clinicId = user.clinicId;
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

  private async resolveUser(request: any) {
    try {
      const base = process.env.BETTER_AUTH_URL || 'http://localhost:3001';
      const url = new URL(request.url, base);

      const headers = new Headers();
      for (const [k, v] of Object.entries(request.headers ?? {})) {
        if (Array.isArray(v)) v.forEach((val) => headers.append(k, val));
        else if (v != null) headers.set(k, String(v));
      }

      const session = await auth.api.getSession({ headers });
      if (!session?.user) return null;

      return {
        id: session.user.id,
        clinicId: (session.user as any).clinicId,
        role: (session.user as any).role,
        email: session.user.email,
        name: session.user.name,
      };
    } catch (error) {
      this.logger.warn(`Session lookup failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
