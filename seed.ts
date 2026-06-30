import 'dotenv/config';
import { db } from './packages/db/src/index';
import { sql } from 'drizzle-orm';

async function seed() {
  try {
    await db.execute(sql`
      INSERT INTO super_admins (email, name, password_hash)
      VALUES ('kadu@kadudeoliveira.com.br', 'Kadu', crypt('K@dusk88##', gen_salt('bf')))
      ON CONFLICT (email) DO NOTHING;
    `);
    console.log('Super admin created!');
  } catch (error) {
    console.error('Error inserting super admin:', error);
  }
  process.exit(0);
}

seed();
