/**
 * seed-naixer-codes.ts — Import Naixer product/modifier codes from CSV (T-0083, ADR-0007)
 *
 * Usage:
 *   pnpm seed:naixer products <file.csv>
 *   pnpm seed:naixer modifiers <file.csv>
 *   pnpm seed:naixer products <file.csv> --dry-run
 *
 * CSV format (products):
 *   product_id,variant_id,naixer_code
 *   abc-123,,T003
 *   abc-123,var-456,T003A
 *
 * CSV format (modifiers):
 *   modifier_kind,modifier_option_id,naixer_code,display_order
 *   size,opt-001,C01,1
 *   ice,opt-002,S02,2
 *
 * Requires DATABASE_URL in .env (or environment).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tenants } from '@erp/db/schema/auth';
import { naixerModifierCodes, naixerProductCodes } from '@erp/db/schema/kitchen';
import { generateId } from '@erp/shared/id';
import { neon } from '@neondatabase/serverless';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import {
  parseModifierCodesCsv,
  parseProductCodesCsv,
} from '../packages/services/src/kitchen/parse-naixer-csv';

// ─── CLI argument parsing ───────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filteredArgs = args.filter((a) => a !== '--dry-run');

const type = filteredArgs[0]; // 'products' | 'modifiers'
const csvPath = filteredArgs[1];

if (!type || !csvPath || !['products', 'modifiers'].includes(type)) {
  console.error(`
Usage:
  pnpm seed:naixer products <file.csv> [--dry-run]
  pnpm seed:naixer modifiers <file.csv> [--dry-run]

CSV format (products):
  product_id,variant_id,naixer_code

CSV format (modifiers):
  modifier_kind,modifier_option_id,naixer_code,display_order
`);
  process.exit(1);
}

// ─── DB connection ──────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set. Add it to .env and retry.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

// ─── Read CSV ───────────────────────────────────────────────────────────────

const fullPath = resolve(csvPath);
let csvContent: string;
try {
  csvContent = readFileSync(fullPath, 'utf-8');
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`❌ Cannot read file: ${fullPath}\n   ${msg}`);
  process.exit(1);
}

// ─── Resolve tenant ─────────────────────────────────────────────────────────

async function getDefaultTenantId(): Promise<string> {
  const [tenant] = await db.select({ id: tenants.id }).from(tenants).limit(1);
  if (!tenant) {
    console.error('❌ No tenant found in database. Run seed first.');
    process.exit(1);
  }
  return tenant.id;
}

// ─── Import products ────────────────────────────────────────────────────────

async function importProducts(csv: string): Promise<void> {
  const { rows, errors } = parseProductCodesCsv(csv);

  if (errors.length > 0) {
    console.error('⚠️  Parse errors:');
    for (const err of errors) {
      console.error(`   Line ${err.line}: ${err.message}`);
    }
  }

  if (rows.length === 0) {
    console.error('❌ No valid rows to import.');
    process.exit(1);
  }

  console.info(`📄 Parsed ${rows.length} product code row(s)`);

  if (dryRun) {
    console.info('\n🔍 Dry run — no changes will be made:\n');
    for (const row of rows) {
      const variant = row.variantId ? ` (variant: ${row.variantId})` : ' (all variants)';
      console.info(`   ${row.productId}${variant} → ${row.naixerCode}`);
    }
    return;
  }

  const tenantId = await getDefaultTenantId();
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const conditions = [
      eq(naixerProductCodes.tenantId, tenantId),
      eq(naixerProductCodes.productId, row.productId),
    ];

    if (row.variantId) {
      conditions.push(eq(naixerProductCodes.variantId, row.variantId));
    }

    const [existing] = await db
      .select({ id: naixerProductCodes.id })
      .from(naixerProductCodes)
      .where(and(...conditions))
      .limit(1);

    if (existing) {
      await db
        .update(naixerProductCodes)
        .set({
          naixerCode: row.naixerCode,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(naixerProductCodes.id, existing.id));
      updated++;
    } else {
      await db.insert(naixerProductCodes).values({
        id: generateId(),
        tenantId,
        productId: row.productId,
        variantId: row.variantId,
        naixerCode: row.naixerCode,
      });
      inserted++;
    }
  }

  console.info(`\n✅ Product codes: ${inserted} inserted, ${updated} updated`);
}

// ─── Import modifiers ───────────────────────────────────────────────────────

async function importModifiers(csv: string): Promise<void> {
  const { rows, errors } = parseModifierCodesCsv(csv);

  if (errors.length > 0) {
    console.error('⚠️  Parse errors:');
    for (const err of errors) {
      console.error(`   Line ${err.line}: ${err.message}`);
    }
  }

  if (rows.length === 0) {
    console.error('❌ No valid rows to import.');
    process.exit(1);
  }

  console.info(`📄 Parsed ${rows.length} modifier code row(s)`);

  if (dryRun) {
    console.info('\n🔍 Dry run — no changes will be made:\n');
    for (const row of rows) {
      console.info(
        `   [${row.modifierKind}] ${row.modifierOptionId} → ${row.naixerCode} (order: ${row.displayOrder})`,
      );
    }
    return;
  }

  const tenantId = await getDefaultTenantId();
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const [existing] = await db
      .select({ id: naixerModifierCodes.id })
      .from(naixerModifierCodes)
      .where(
        and(
          eq(naixerModifierCodes.tenantId, tenantId),
          eq(naixerModifierCodes.modifierOptionId, row.modifierOptionId),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(naixerModifierCodes)
        .set({
          naixerCode: row.naixerCode,
          modifierKind: row.modifierKind,
          displayOrder: row.displayOrder,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(naixerModifierCodes.id, existing.id));
      updated++;
    } else {
      await db.insert(naixerModifierCodes).values({
        id: generateId(),
        tenantId,
        modifierKind: row.modifierKind,
        modifierOptionId: row.modifierOptionId,
        naixerCode: row.naixerCode,
        displayOrder: row.displayOrder,
      });
      inserted++;
    }
  }

  console.info(`\n✅ Modifier codes: ${inserted} inserted, ${updated} updated`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.info(`\n🌱 Naixer code import — ${type}`);
  console.info(`   File: ${fullPath}`);
  if (dryRun) console.info('   Mode: DRY RUN');
  console.info('');

  if (type === 'products') {
    await importProducts(csvContent);
  } else {
    await importModifiers(csvContent);
  }

  console.info('\n🎉 Import complete!');
}

main().catch((e) => {
  console.error('❌ Import failed:', e);
  process.exit(1);
});
