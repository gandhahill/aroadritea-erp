/**
 * Seed runner — inserts all seed data into the database.
 * Usage: pnpm --filter @erp/db seed
 *
 * Requires DATABASE_URL in .env. Seeds are idempotent (onConflictDoNothing).
 * Order: tenants → locations → roles → permissions → role_permissions → users → user_roles → COA
 */

import { generateId } from '@erp/shared/id';
import { neon } from '@neondatabase/serverless';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import type { Database } from '../client';
import { accounts, taxRates, taxRules } from '../schema/accounting';
import {
  locations,
  permissions,
  rolePermissions,
  roles,
  tenants,
  userRoles,
  users,
} from '../schema/auth';
import { naixerQrFormatConfig } from '../schema/kitchen';
import { posSettings } from '../schema/pos';
import { scheduledJobs } from '../schema/scheduled-jobs';
import { COA_SEED } from './coa';
import {
  DEFAULT_TENANT,
  DEV_ADMIN_USER,
  LOCATIONS_SEED,
  PERMISSIONS_SEED,
  ROLES_SEED,
  ROLE_PERMISSION_MAP,
} from './iam';
import { seedMenu } from './menu';
import { NAIXER_QR_FORMAT_DEFAULTS } from './naixer-seed';
import { SCHEDULED_JOBS_SEED } from './scheduled-jobs-seed';
import { TAX_RATES_SEED } from './tax-rates';
import { TAX_RULES_SEED } from './tax-rules-seed';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set. Add it to .env and retry.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

async function seed() {
  console.info('🌱 Starting seed...\n');

  // 1. Tenant
  const tenantId = DEFAULT_TENANT.id;
  await db
    .insert(tenants)
    .values({
      id: tenantId,
      name: DEFAULT_TENANT.name,
      localeDefault: DEFAULT_TENANT.localeDefault,
    })
    .onConflictDoNothing();
  console.info('✅ Tenant seeded');

  // 2. Locations
  const locationIds = new Map<string, string>();
  for (const loc of LOCATIONS_SEED) {
    const id = generateId();
    locationIds.set(loc.code, id);
    await db
      .insert(locations)
      .values({
        id,
        tenantId,
        code: loc.code,
        name: loc.name,
        type: loc.type,
        address: loc.address,
      })
      .onConflictDoNothing();
  }
  const locationRows = await db
    .select({ id: locations.id, code: locations.code })
    .from(locations)
    .where(eq(locations.tenantId, tenantId));
  locationIds.clear();
  for (const loc of locationRows) {
    locationIds.set(loc.code, loc.id);
  }
  console.info(`✅ ${LOCATIONS_SEED.length} locations seeded`);

  // 3. Roles
  const roleIds = new Map<string, string>();
  for (const role of ROLES_SEED) {
    const id = generateId();
    roleIds.set(role.code, id);
    await db
      .insert(roles)
      .values({
        id,
        tenantId,
        code: role.code,
        name: role.name,
      })
      .onConflictDoNothing();
  }
  console.info(`✅ ${ROLES_SEED.length} roles seeded`);

  // 4. Permissions
  const permIds = new Map<string, string>();
  for (const perm of PERMISSIONS_SEED) {
    const id = generateId();
    permIds.set(perm.code, id);
    await db
      .insert(permissions)
      .values({
        id,
        code: perm.code,
        module: perm.module,
      })
      .onConflictDoNothing();
  }
  console.info(`✅ ${PERMISSIONS_SEED.length} permissions seeded`);

  // 5. Role-Permission mapping
  let rpCount = 0;
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSION_MAP)) {
    const roleId = roleIds.get(roleCode);
    if (!roleId) continue;
    for (const permCode of permCodes) {
      const permId = permIds.get(permCode);
      if (!permId) continue;
      await db
        .insert(rolePermissions)
        .values({
          roleId,
          permissionId: permId,
        })
        .onConflictDoNothing();
      rpCount++;
    }
  }
  console.info(`✅ ${rpCount} role-permission mappings seeded`);

  // 6. Dev admin user
  const adminId = generateId();
  const passwordHash = await argon2.hash('Admin123!', {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await db
    .insert(users)
    .values({
      id: adminId,
      tenantId,
      email: DEV_ADMIN_USER.email,
      passwordHash,
      displayName: DEV_ADMIN_USER.displayName,
      locale: DEV_ADMIN_USER.locale,
      status: DEV_ADMIN_USER.status,
      emailVerified: new Date(),
    })
    .onConflictDoNothing();
  console.info(`✅ Admin user seeded (${DEV_ADMIN_USER.email})`);

  // 7. Assign director role to admin (global scope)
  const directorRoleId = roleIds.get(DEV_ADMIN_USER.roleCode);
  if (directorRoleId) {
    await db
      .insert(userRoles)
      .values({
        userId: adminId,
        roleId: directorRoleId,
        locationId: null,
      })
      .onConflictDoNothing();
    console.info('✅ Admin assigned director role (global)');
  }

  // 8. COA (Chart of Accounts)
  for (const acct of COA_SEED) {
    await db
      .insert(accounts)
      .values({
        id: generateId(),
        tenantId,
        code: acct.code,
        name: acct.name,
        type: acct.type,
        subtype: acct.subtype,
        normalBalance: acct.normalBalance,
        isPostable: acct.isPostable,
      })
      .onConflictDoNothing();
  }
  console.info(`✅ ${COA_SEED.length} COA accounts seeded`);

  // 9. Tax Rates (resolve COA codes → account IDs)
  const coaRows = await db
    .select({ id: accounts.id, code: accounts.code })
    .from(accounts)
    .where(eq(accounts.tenantId, tenantId));
  const coaMap = new Map(coaRows.map((r) => [r.code, r.id]));

  let taxCount = 0;
  for (const rate of TAX_RATES_SEED) {
    const postingAccountId = coaMap.get(rate.postingAccountCode);
    if (!postingAccountId) {
      console.warn(
        `⚠️ Tax rate ${rate.code}: posting account ${rate.postingAccountCode} not found in COA, skipping`,
      );
      continue;
    }
    await db
      .insert(taxRates)
      .values({
        id: generateId(),
        code: rate.code,
        name: rate.name,
        rateBps: rate.rateBps,
        calculation: rate.calculation,
        postingAccountId,
        isActive: rate.isActive,
        effectiveFrom: rate.effectiveFrom,
      })
      .onConflictDoNothing();
    taxCount++;
  }
  console.info(`✅ ${taxCount} tax rates seeded`);

  // 10. Tax Rules (SD §19.3.2 — PPN opt-in engine)
  let ruleCount = 0;
  for (const rule of TAX_RULES_SEED) {
    await db
      .insert(taxRules)
      .values({
        id: generateId(),
        tenantId,
        scopeKind: rule.scopeKind,
        scopeId: rule.scopeId,
        taxCode: rule.taxCode,
        isAppliedDefault: rule.isAppliedDefault,
        priority: rule.priority,
        effectiveFrom: rule.effectiveFrom,
      })
      .onConflictDoNothing();
    ruleCount++;
  }
  console.info(`✅ ${ruleCount} tax rules seeded`);

  // 11. Aroadri Tea menu master data (UI-managed after bootstrap)
  const menuResult = await seedMenu(db as unknown as Database, tenantId);
  console.info(
    `✅ ${menuResult.products} menu products, ${menuResult.categories} categories, ${menuResult.modifierGroups} modifier groups seeded`,
  );

  // 12. POS operational settings (UI-managed after bootstrap)
  let posSettingsCount = 0;
  for (const loc of locationRows) {
    await db
      .insert(posSettings)
      .values({
        id: generateId(),
        tenantId,
        locationId: loc.id,
        pb1TaxCode: 'PB1',
        cashAccountCode: '1-1030',
        revenueAccountCode: '4-1010',
        donationTrustAccountCode: '2-2050',
        deliveryChannelsJson: ['gofood', 'grabfood', 'shopeefood'],
        deliveryNetBps: 8000,
        receiptWidthMm: 80,
      })
      .onConflictDoNothing();
    posSettingsCount++;
  }
  console.info(`✅ ${posSettingsCount} POS settings seeded`);

  // 13. Naixer QR + label print defaults
  let naixerConfigCount = 0;
  for (const cfg of NAIXER_QR_FORMAT_DEFAULTS) {
    const locationId = locationIds.get(cfg.locationCode);
    if (!locationId) continue;
    await db
      .insert(naixerQrFormatConfig)
      .values({
        id: generateId(),
        locationId,
        format: cfg.format,
        includeOrderId: cfg.includeOrderId,
        parameterOrderJson: cfg.parameterOrder,
        labelWidthMm: cfg.labelWidthMm,
        labelHeightMm: cfg.labelHeightMm,
      })
      .onConflictDoNothing();
    naixerConfigCount++;
  }
  console.info(`✅ ${naixerConfigCount} Naixer QR format configs seeded`);

  // 14. Scheduled Jobs
  for (const job of SCHEDULED_JOBS_SEED) {
    await db
      .insert(scheduledJobs)
      .values({
        id: generateId(),
        tenantId,
        name: job.name,
        label: job.label,
        description: job.description,
        cronExpression: job.cronExpression,
        timezone: job.timezone,
        jobData: job.jobData,
        enabled: job.enabled,
      })
      .onConflictDoNothing();
  }
  console.info(`✅ ${SCHEDULED_JOBS_SEED.length} scheduled jobs seeded`);

  console.info('\n🎉 Seed complete!');
}

seed().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
