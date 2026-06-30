import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Check for super admin token in header
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Token de super admin não fornecido');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token || token === 'undefined' || token === 'null') {
      throw new UnauthorizedException('Token de super admin inválido ou não fornecido');
    }

    // For now, use a simple approach: the token is the super admin ID
    // TODO: Replace with proper JWT validation
    const superAdmin = await db
      .select()
      .from(schema.superAdmins)
      .where(eq(schema.superAdmins.id, token))
      .limit(1);

    if (!superAdmin[0]) {
      throw new UnauthorizedException('Super admin inválido');
    }

    request.superAdmin = superAdmin[0];
    return true;
  }
}
