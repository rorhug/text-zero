import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

config({
  path: '.env.local',
});

const runMigrate = async () => {
  // Create data directory if it doesn't exist
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = process.env.DATABASE_URL || join(dataDir, 'sqlite.db');
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);

  console.log('⏳ Running migrations...');

  const start = Date.now();
  migrate(db, { migrationsFolder: './lib/db/migrations' });
  const end = Date.now();

  console.log('✅ Migrations completed in', end - start, 'ms');
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error('❌ Migration failed');
  console.error(err);
  process.exit(1);
});
