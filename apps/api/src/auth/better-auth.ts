import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@crm-clinicas/db';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
  },
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  secret: process.env.BETTER_AUTH_SECRET || 'secret-key-for-dev-only',
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'https://clinicia.useia.api.br',
    'http://localhost:3000',
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
