/**
 * Seed runner — inserts all seed data into the database.
 * Usage: pnpm --filter @erp/db seed
 *
 * Requires DATABASE_URL in .env. Seeds are idempotent. UI-managed business
 * configuration is created only when missing and is not overwritten on rerun.
 * Order: tenants → locations → roles → permissions → role_permissions → optional bootstrap admin → COA
 */

import { generateId } from '@erp/shared/id';
import { neon } from '@neondatabase/serverless';
import * as argon2 from 'argon2';
import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import type { Database } from '../client';
import { accountingPeriods, accounts, taxRates, taxRules } from '../schema/accounting';
import {
  authAccounts,
  locations,
  permissions,
  rolePermissions,
  roles,
  tenants,
  userRoles,
  users,
} from '../schema/auth';
import { customFieldDefinitions, customFieldValues } from '../schema/customfield';
import { leaveTypes, shiftDefinitions } from '../schema/hr';
import { naixerQrFormatConfig } from '../schema/kitchen';
import { posSettings } from '../schema/pos';
import { scheduledJobs } from '../schema/scheduled-jobs';
import { COA_SEED, LEGACY_COA_CODES_TO_DEACTIVATE } from './coa';
import {
  DEFAULT_TENANT,
  DEV_ADMIN_USER,
  LEGACY_INACTIVE_LOCATION_CODES,
  LOCATIONS_SEED,
  PERMISSIONS_SEED,
  ROLES_SEED,
  ROLE_PERMISSION_MAP,
} from './iam';
import { LEAVE_TYPES_SEED } from './leave-types-seed';
import { LOCATION_GPS_FIELDS, LOCATION_GPS_VALUES } from './location-gps';
import { seedMenu } from './menu';
import { NAIXER_QR_FORMAT_DEFAULTS } from './naixer-seed';
import { SCHEDULED_JOBS_SEED } from './scheduled-jobs-seed';
import { SHIFT_DEFINITIONS_SEED } from './shift-definitions-seed';
import { TAX_RATES_SEED } from './tax-rates';
import { TAX_RULES_SEED } from './tax-rules-seed';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set. Add it to .env and retry.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

const DEFAULT_DELIVERY_CHANNELS = [
  { id: 'gofood', label: 'GoFood', netBps: 8000, commissionBps: 2000, enabled: true },
  { id: 'grabfood', label: 'GrabFood', netBps: 8000, commissionBps: 2000, enabled: true },
  { id: 'shopeefood', label: 'ShopeeFood', netBps: 8000, commissionBps: 2000, enabled: true },
];

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
    await db
      .insert(locations)
      .values({
        id,
        tenantId,
        code: loc.code,
        name: loc.name,
        type: loc.type,
        address: loc.address,
        status: 'active',
      })
      .onConflictDoNothing({ target: [locations.tenantId, locations.code] });
  }

  await db
    .update(locations)
    .set({ status: 'inactive', updatedAt: new Date() })
    .where(
      and(
        eq(locations.tenantId, tenantId),
        inArray(locations.code, LEGACY_INACTIVE_LOCATION_CODES),
      ),
    );

  const locationRows = await db
    .select({ id: locations.id, code: locations.code })
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, tenantId),
        eq(locations.status, 'active'),
        eq(locations.type, 'store'),
      ),
    );
  for (const loc of locationRows) {
    locationIds.set(loc.code, loc.id);
  }
  console.info(`✅ ${LOCATIONS_SEED.length} locations seeded`);

  // 2b. Location GPS settings (custom fields, UI-editable)
  const gpsDefinitionIds = new Map<string, string>();
  for (const field of LOCATION_GPS_FIELDS) {
    const [existing] = await db
      .select({ id: customFieldDefinitions.id })
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.tenantId, tenantId),
          eq(customFieldDefinitions.entityType, 'location'),
          eq(customFieldDefinitions.key, field.key),
        ),
      )
      .limit(1);

    const definitionId = existing?.id ?? generateId();
    if (!existing) {
      await db.insert(customFieldDefinitions).values({
        id: definitionId,
        tenantId,
        entityType: 'location',
        key: field.key,
        name: field.name,
        dataType: 'number',
        isRequired: false,
        isIndexed: true,
        displayOrder: field.displayOrder,
      });
    }
    gpsDefinitionIds.set(field.key, definitionId);
  }

  for (const [locationCode, values] of Object.entries(LOCATION_GPS_VALUES)) {
    const entityId = locationIds.get(locationCode);
    if (!entityId) continue;
    for (const [key, value] of Object.entries(values)) {
      const definitionId = gpsDefinitionIds.get(key);
      if (!definitionId) continue;
      await db
        .insert(customFieldValues)
        .values({
          definitionId,
          entityId,
          value,
        })
        .onConflictDoUpdate({
          target: [customFieldValues.definitionId, customFieldValues.entityId],
          set: { value, updatedAt: new Date() },
        });
    }
  }
  console.info('✅ Location GPS attendance settings seeded');

  // 3. Roles
  const roleIds = new Map<string, string>();
  for (const role of ROLES_SEED) {
    const id = generateId();
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
  const roleRows = await db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(eq(roles.tenantId, tenantId));
  for (const role of roleRows) {
    roleIds.set(role.code, role.id);
  }
  console.info(`✅ ${ROLES_SEED.length} roles seeded`);

  // 4. Permissions
  const permIds = new Map<string, string>();
  for (const perm of PERMISSIONS_SEED) {
    const id = generateId();
    await db
      .insert(permissions)
      .values({
        id,
        code: perm.code,
        module: perm.module,
      })
      .onConflictDoNothing();
  }
  const permissionRows = await db
    .select({ id: permissions.id, code: permissions.code })
    .from(permissions);
  for (const perm of permissionRows) {
    permIds.set(perm.code, perm.id);
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

  // 6. Optional bootstrap admin user
  const bootstrapAdmin = getBootstrapAdminConfig();
  if (bootstrapAdmin) {
    const adminId = generateId();
    const passwordHash = await argon2.hash(bootstrapAdmin.password, {
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
        email: bootstrapAdmin.email,
        passwordHash,
        displayName: bootstrapAdmin.displayName,
        locale: bootstrapAdmin.locale,
        status: DEV_ADMIN_USER.status,
        emailVerified: new Date(),
      })
      .onConflictDoNothing();
    const [adminRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, bootstrapAdmin.email))
      .limit(1);
    const resolvedAdminId = adminRow?.id ?? adminId;
    console.info(`✅ Bootstrap admin present (${bootstrapAdmin.email})`);

    await db
      .insert(authAccounts)
      .values({
        id: generateId(),
        userId: resolvedAdminId,
        accountId: resolvedAdminId,
        providerId: 'credential',
        password: passwordHash,
      })
      .onConflictDoUpdate({
        target: [authAccounts.providerId, authAccounts.accountId],
        set: {
          password: passwordHash,
          updatedAt: new Date(),
        },
      });
    console.info('✅ Bootstrap admin credential account ready');

    const directorRoleId = roleIds.get(bootstrapAdmin.roleCode);
    if (directorRoleId) {
      await db
        .insert(userRoles)
        .values({
          userId: resolvedAdminId,
          roleId: directorRoleId,
          locationId: null,
        })
        .onConflictDoNothing();
      console.info('✅ Bootstrap admin assigned director role (global)');
    }
  } else {
    console.info('ℹ️  Bootstrap admin skipped (set SEED_ADMIN_PASSWORD to create one)');
  }

  // 7. COA (Chart of Accounts)
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
      .onConflictDoUpdate({
        target: [accounts.tenantId, accounts.code],
        set: {
          name: acct.name,
          type: acct.type,
          subtype: acct.subtype,
          normalBalance: acct.normalBalance,
          isPostable: acct.isPostable,
          updatedAt: new Date(),
        },
      });
  }

  await db
    .update(accounts)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(eq(accounts.tenantId, tenantId), inArray(accounts.code, LEGACY_COA_CODES_TO_DEACTIVATE)),
    );
  console.info(`✅ ${COA_SEED.length} COA accounts seeded`);

  // 9. Tax Rates (resolve COA codes → account IDs)
  const now = new Date();
  const periodYears = [now.getFullYear(), now.getFullYear() + 1];
  let periodCount = 0;
  for (const year of periodYears) {
    for (let month = 1; month <= 12; month++) {
      const code = `${year}-${String(month).padStart(2, '0')}`;
      const startDate = `${code}-01`;
      const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      await db
        .insert(accountingPeriods)
        .values({
          id: generateId(),
          tenantId,
          code,
          startDate,
          endDate,
          status: 'open',
        })
        .onConflictDoNothing();
      periodCount++;
    }
  }
  console.info(`✅ ${periodCount} accounting periods ensured`);

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
      .onConflictDoUpdate({
        target: taxRates.code,
        set: {
          name: rate.name,
          rateBps: rate.rateBps,
          calculation: rate.calculation,
          postingAccountId,
          isActive: rate.isActive,
          effectiveFrom: rate.effectiveFrom,
          updatedAt: new Date(),
        },
      });
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

  // 11b. HR leave types
  let leaveTypeCount = 0;
  for (const leaveType of LEAVE_TYPES_SEED) {
    await db
      .insert(leaveTypes)
      .values({
        id: leaveType.id,
        tenantId,
        code: leaveType.code,
        name: leaveType.name,
        annualQuotaDays: leaveType.annualQuotaDays,
        isPaid: leaveType.isPaid,
        requiresApproval: leaveType.requiresApproval,
        isActive: leaveType.isActive,
      })
      .onConflictDoUpdate({
        target: [leaveTypes.tenantId, leaveTypes.code],
        set: {
          name: leaveType.name,
          annualQuotaDays: leaveType.annualQuotaDays,
          isPaid: leaveType.isPaid,
          requiresApproval: leaveType.requiresApproval,
          isActive: leaveType.isActive,
          updatedAt: new Date(),
        },
      });
    leaveTypeCount++;
  }
  console.info(`✅ ${leaveTypeCount} leave types seeded`);

  // 11c. HR shift definitions (UI-managed after bootstrap)
  const defaultShiftLocationId = locationRows[0]?.id;
  let shiftDefinitionCount = 0;
  if (defaultShiftLocationId) {
    for (const shift of SHIFT_DEFINITIONS_SEED) {
      await db
        .insert(shiftDefinitions)
        .values({
          id: shift.id,
          tenantId,
          locationId: defaultShiftLocationId,
          code: shift.code,
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakStart: shift.breakStart,
          breakEnd: shift.breakEnd,
          isActive: shift.isActive,
        })
        .onConflictDoUpdate({
          target: [shiftDefinitions.tenantId, shiftDefinitions.code],
          set: {
            locationId: defaultShiftLocationId,
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            breakStart: shift.breakStart,
            breakEnd: shift.breakEnd,
            isActive: shift.isActive,
            updatedAt: new Date(),
          },
        });
      shiftDefinitionCount++;
    }
  }
  console.info(`âœ… ${shiftDefinitionCount} shift definitions seeded`);

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
        cashAccountCode: '1-1300',
        revenueAccountCode: '4-1100',
        donationTrustAccountCode: '2-2050',
        deliveryChannelsJson: DEFAULT_DELIVERY_CHANNELS,
        deliveryNetBps: 8000,
        receiptWidthMm: 80,
      })
      .onConflictDoNothing({ target: [posSettings.tenantId, posSettings.locationId] });
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

function getBootstrapAdminConfig(): {
  email: string;
  password: string;
  displayName: string;
  locale: 'id' | 'en' | 'zh';
  roleCode: string;
} | null {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) return null;
  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters.');
  }

  return {
    email: process.env.SEED_ADMIN_EMAIL ?? DEV_ADMIN_USER.email,
    password,
    displayName: process.env.SEED_ADMIN_NAME ?? DEV_ADMIN_USER.displayName,
    locale: DEV_ADMIN_USER.locale,
    roleCode: DEV_ADMIN_USER.roleCode,
  };
}

seed().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
