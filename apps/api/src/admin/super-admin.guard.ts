import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { db, schema } from '@crm-clinicas/db';
import { eq } from 'drizzle-orm';

function verifyAdminToken(token: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new UnauthorizedException('Server misconfiguration');

  const parts = token.split('.');
  if (parts.length !== 2) throw new UnauthorizedException('Token inválido');

  const payload = parts[0]!;
  const sig = parts[1]!;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  const sigBuf = Buffer.from(sig, 'base64url');
  const expectedBuf = Buffer.from(expectedSig, 'base64url');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new UnauthorizedException('Token inválido');
  }

  let parsed: { sub: string; exp: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    throw new UnauthorizedException('Token inválido');
  }

  if (Math.floor(Date.now() / 1000) > parsed.exp) {
    throw new UnauthorizedException('Token expirado');
  }

  return parsed.sub;
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Token de super admin não fornecido');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token || token === 'undefined' || token === 'null') {
      throw new UnauthorizedException('Token de super admin inválido');
    }

    const adminId = verifyAdminToken(token);

    const superAdmin = await db
      .select()
      .from(schema.superAdmins)
      .where(eq(schema.superAdmins.id, adminId))
      .limit(1);

    if (!superAdmin[0]) {
      throw new UnauthorizedException('Super admin inválido');
    }

    request.superAdmin = superAdmin[0];
    return true;
  }
}
