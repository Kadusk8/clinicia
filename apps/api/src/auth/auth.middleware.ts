import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from './better-auth';

/**
 * Middleware that validates the Better Auth session cookie and populates
 * request.user with { id, clinicId, role, email, name }.
 *
 * Without this middleware, request.user is always undefined and the
 * TenantGuard rejects every request.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  async use(req: FastifyRequest, _res: FastifyReply, next: () => void) {
    try {
      // Build a standard Request from the Fastify request so Better Auth can
      // parse its own cookies/headers.
      const base = process.env.BETTER_AUTH_URL || 'http://localhost:3001';
      const url = new URL(req.url, base);

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) v.forEach((val) => headers.append(k, val));
        else if (v != null) headers.set(k, String(v));
      }

      const request = new Request(url.toString(), { method: 'GET', headers });

      const session = await auth.api.getSession({ headers: request.headers });

      if (session?.user) {
        (req as any).user = {
          id: session.user.id,
          clinicId: (session.user as any).clinicId,
          role: (session.user as any).role,
          email: session.user.email,
          name: session.user.name,
        };
        this.logger.log(`[${req.id}] Auth OK: user=${session.user.id} clinicId=${(session.user as any).clinicId} reqCtor=${req.constructor?.name}`);
      } else {
        this.logger.warn(`[${req.id}] No session for ${req.url} (cookie present: ${!!req.headers.cookie})`);
      }
    } catch (error) {
      this.logger.warn(`[${req.id}] AuthMiddleware error on ${req.url}: ${error instanceof Error ? error.message : String(error)}`);
    }

    next();
  }
}
