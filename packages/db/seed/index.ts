/**
 * Seed runner — run all seed scripts.
 * Usage: pnpm --filter @erp/db seed
 *
 * NOTE: Requires DATABASE_URL in .env. Seeds are idempotent (upsert on code).
 * Currently exports seed data only (no DB writes until Neon project is created).
 */

export { COA_SEED } from './coa';
export { DEFAULT_TENANT, LOCATIONS_SEED, PERMISSIONS_SEED, ROLES_SEED, ROLE_PERMISSION_MAP } from './iam';

console.log('✅ Seed data modules loaded successfully.');
console.log(`   COA: ready (import from ./coa)`);
console.log(`   IAM: ready (import from ./iam)`);
console.log('');
console.log('⚠️  To run actual DB seeding, set DATABASE_URL in .env and implement the insert logic.');
