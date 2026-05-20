import { generateId } from '@erp/shared/id';
import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '../client';
import { accounts, fixedAssetCategories } from '../schema/accounting';

const n = (id: string, en: string, zh: string) => ({ id, en, zh });

export const FIXED_ASSET_CATEGORIES_SEED = [
  {
    code: 'store_equipment',
    name: n('Peralatan Toko', 'Store Equipment', '门店设备'),
    assetAccountCode: '1-4400',
    accumulatedDepreciationAccountCode: '1-4410',
    depreciationExpenseAccountCode: '6-3300',
    defaultUsefulLifeMonths: 48,
    defaultDepreciationMethod: 'straight_line',
  },
  {
    code: 'office_equipment',
    name: n('Peralatan Kantor', 'Office Equipment', '办公设备'),
    assetAccountCode: '1-4500',
    accumulatedDepreciationAccountCode: '1-4510',
    depreciationExpenseAccountCode: '6-3200',
    defaultUsefulLifeMonths: 48,
    defaultDepreciationMethod: 'straight_line',
  },
  {
    code: 'machine',
    name: n('Mesin', 'Machine', '机器'),
    assetAccountCode: '1-4600',
    accumulatedDepreciationAccountCode: '1-4610',
    depreciationExpenseAccountCode: '6-3100',
    defaultUsefulLifeMonths: 60,
    defaultDepreciationMethod: 'straight_line',
  },
  {
    code: 'trademark',
    name: n('Merek Dagang', 'Trademark', '商标'),
    assetAccountCode: '1-4700',
    accumulatedDepreciationAccountCode: '1-4710',
    depreciationExpenseAccountCode: '6-3400',
    defaultUsefulLifeMonths: 120,
    defaultDepreciationMethod: 'straight_line',
  },
  {
    code: 'furniture_fixture',
    name: n('Furnitur dan Fixture', 'Furniture and Fixture', '家具及固定装置'),
    assetAccountCode: '1-4800',
    accumulatedDepreciationAccountCode: '1-4810',
    depreciationExpenseAccountCode: '6-3000',
    defaultUsefulLifeMonths: 48,
    defaultDepreciationMethod: 'straight_line',
  },
] as const;

export async function seedFixedAssetCategories(db: Database, tenantId: string) {
  const codes = [
    ...new Set(
      FIXED_ASSET_CATEGORIES_SEED.flatMap((category) => [
        category.assetAccountCode,
        category.accumulatedDepreciationAccountCode,
        category.depreciationExpenseAccountCode,
      ]),
    ),
  ];
  const accountRows = await db
    .select({ id: accounts.id, code: accounts.code })
    .from(accounts)
    .where(and(eq(accounts.tenantId, tenantId), inArray(accounts.code, codes)));
  const accountIdByCode = new Map(accountRows.map((row) => [row.code, row.id]));

  let seeded = 0;
  for (const category of FIXED_ASSET_CATEGORIES_SEED) {
    const assetAccountId = accountIdByCode.get(category.assetAccountCode);
    const accumulatedDepreciationAccountId = accountIdByCode.get(
      category.accumulatedDepreciationAccountCode,
    );
    const depreciationExpenseAccountId = accountIdByCode.get(
      category.depreciationExpenseAccountCode,
    );
    if (!assetAccountId || !accumulatedDepreciationAccountId || !depreciationExpenseAccountId) {
      continue;
    }

    await db
      .insert(fixedAssetCategories)
      .values({
        id: generateId(),
        tenantId,
        code: category.code,
        name: category.name,
        assetAccountId,
        accumulatedDepreciationAccountId,
        depreciationExpenseAccountId,
        defaultUsefulLifeMonths: category.defaultUsefulLifeMonths,
        defaultDepreciationMethod: category.defaultDepreciationMethod,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [fixedAssetCategories.tenantId, fixedAssetCategories.code],
        set: {
          name: category.name,
          assetAccountId,
          accumulatedDepreciationAccountId,
          depreciationExpenseAccountId,
          defaultUsefulLifeMonths: category.defaultUsefulLifeMonths,
          defaultDepreciationMethod: category.defaultDepreciationMethod,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    seeded++;
  }

  return { seeded };
}
