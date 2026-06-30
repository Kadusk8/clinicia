import { Injectable } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class AuthService {
  async findUserByEmail(email: string) {
    const result = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    return result[0] || null;
  }

  async findUserById(id: string) {
    const result = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return result[0] || null;
  }

  // TODO: Implement Better Auth integration
  // - login / register
  // - session management
  // - clinicId in context
}
