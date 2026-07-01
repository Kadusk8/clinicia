import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) throw new Error('DATABASE_URL not set');

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function main() {
  console.log('⚡ Enabling pgvector extension...');
  await client`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log('✅ pgvector ready');

  console.log('🔄 Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✅ Migrations complete');

  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
