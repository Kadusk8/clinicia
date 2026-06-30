import postgres from 'postgres';

async function seed() {
  const sql = postgres("postgresql://neondb_owner:npg_ig3mPGFA4COa@ep-divine-bird-adm0qs1t-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require");
  
  try {
    await sql`
      INSERT INTO super_admins (email, name, password_hash)
      VALUES ('kadu@kadudeoliveira.com.br', 'Kadu', crypt('K@dusk88##', gen_salt('bf')))
      ON CONFLICT (email) DO NOTHING;
    `;
    console.log('Super admin created successfully!');
  } catch(e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
seed();
