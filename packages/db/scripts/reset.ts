/**
 * Reset the database: drop the public schema and all objects, then
 * recreate the empty schema. Caller is expected to run `pnpm db:migrate`
 * and `pnpm db:seed` afterwards.
 *
 * Safety guards:
 * - Refuses to run if NODE_ENV=production unless ALLOW_PROD_DB_RESET=1.
 * - Requires the env var CONFIRM_DB_RESET=YES so a stray `pnpm db:reset`
 *   keystroke can't wipe a real database by accident.
 * - Logs the DATABASE_URL host before acting.
 *
 * Usage:
 *   CONFIRM_DB_RESET=YES pnpm --filter @erp/db db:reset
 */

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load .env from repo root and packages/db just in case.
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), 'packages/db/.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR DATABASE_URL is not set.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_DB_RESET !== '1') {
  console.error('ERROR Refusing to reset a production database without ALLOW_PROD_DB_RESET=1.');
  process.exit(2);
}

if (process.env.CONFIRM_DB_RESET !== 'YES') {
  console.error(
    'ERROR Set CONFIRM_DB_RESET=YES to proceed. This drops the public schema and all data.',
  );
  process.exit(3);
}

const host = (() => {
  try {
    return new URL(DATABASE_URL).host;
  } catch {
    return 'unknown-host';
  }
})();

console.info(`WARNING Resetting database on host: ${host}`);
console.info('   DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

const sql = neon(DATABASE_URL);

try {
  await sql`DROP SCHEMA IF EXISTS public CASCADE`;
  await sql`CREATE SCHEMA public`;
  await sql`GRANT ALL ON SCHEMA public TO public`;
  console.info('Schema reset complete. Next steps:');
  console.info('     pnpm --filter @erp/db db:migrate');
  console.info('     pnpm --filter @erp/db db:seed');
} catch (error) {
  console.error('ERROR Reset failed:', error);
  process.exit(4);
}


