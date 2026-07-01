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
  // Ensure that the auth cookie/session is aware of our domains
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  secret: process.env.BETTER_AUTH_SECRET || 'secret-key-for-dev-only',
});
