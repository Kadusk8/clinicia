const postgres = require('postgres');
async function test() {
  const sql = postgres("postgresql://neondb_owner:npg_ig3mPGFA4COa@ep-divine-bird-adm0qs1t-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require");
  try {
    const res = await sql`SELECT * FROM super_admins`;
    console.log(res);
  } finally {
    await sql.end();
  }
}
test();
