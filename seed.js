const { Client } = require('pg');

async function seed() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_ig3mPGFA4COa@ep-divine-bird-adm0qs1t-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
  });
  await client.connect();
  try {
    await client.query(`
      INSERT INTO super_admins (email, name, password_hash)
      VALUES ('kadu@kadudeoliveira.com.br', 'Kadu', crypt('K@dusk88##', gen_salt('bf')))
      ON CONFLICT (email) DO NOTHING;
    `);
    console.log('Super admin created successfully!');
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
seed();
