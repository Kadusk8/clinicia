const postgres = require('postgres');

async function seed() {
  const sql = postgres("postgresql://neondb_owner:npg_ig3mPGFA4COa@ep-divine-bird-adm0qs1t-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require");
  try {
    await sql`
      UPDATE super_admins
      SET password_hash = '87cba4a91659a55129c1f3cb722a9a7d16054b0aa4745f1227b2f398cea62982'
      WHERE email = 'kadu@kadudeoliveira.com.br';
    `;
    console.log('Super admin password fixed!');
  } catch(e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
seed();
