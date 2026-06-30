import { db, schema } from '@crm-clinicas/db';
import { eq } from 'drizzle-orm';

async function test() {
  const result = await db
    .select()
    .from(schema.superAdmins)
    .where(eq(schema.superAdmins.email, 'kadu@kadudeoliveira.com.br'))
    .limit(1);

  console.log(result[0]);
}
test();
