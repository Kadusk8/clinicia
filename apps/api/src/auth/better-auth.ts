import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, schema } from '@crm-clinicas/db';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    // Our tables use custom names (users plural, others singular). Map Better
    // Auth models to the actual Drizzle tables, otherwise schema['user'] is
    // undefined and every sign-in throws (500).
    schema: {
      user: schema.users,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  // In production, main.ts validates BETTER_AUTH_SECRET is set before bootstrap.
  // The fallback is only used in development.
  secret: process.env.BETTER_AUTH_SECRET || 'secret-key-for-dev-only',
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ],
  advanced:
    process.env.NODE_ENV === 'production'
      ? {
          crossSubDomainCookies: { enabled: true, domain: '.useia.api.br' },
          defaultCookieAttributes: { sameSite: 'none', secure: true },
        }
      : undefined,
  user: {
    // Expose clinicId and role in the session so TenantGuard can read request.user.clinicId
    additionalFields: {
      clinicId: {
        type: 'string',
        required: true,
        fieldName: 'clinic_id',
      },
      role: {
        type: 'string',
        required: true,
        fieldName: 'role',
      },
    },
  },
});
