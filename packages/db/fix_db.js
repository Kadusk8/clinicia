const postgres = require('postgres');
require('dotenv').config({ path: '../../.env' });
async function run() {
  const sql = postgres(process.env.DATABASE_URL);
  await sql`ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "evolution_api_url" varchar(255)`;
  await sql`ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "evolution_api_key" varchar(255)`;
  console.log("Columns added");
  process.exit(0);
}
run();
