/**
 * Aroadri Tea recipe seed — Fresh Tea / Lemon Tea / Milk Tea.
 *
 * Source: user-provided recipe photos, 2026-05-17. The photos document
 * 3 beverage families × 3 base teas × 2 cup sizes × 2 temperatures ×
 * 3 sweetness levels, with grams/ml per ingredient per combination.
 *
 * Strategy:
 * 1. Seed three "raw material" ingredient products per family
 *    (tea concentrate, base syrup, ice sugar syrup, creamer, lemon),
 *    each keyed in millilitres / grams.
 * 2. Seed one finished-good product per (family × base-tea), with
 *    cup-size variants 500ml / 700ml.
 * 3. For each finished-good variant, attach a BOM that captures the
 *    "standard sugar, standard ice" recipe at the bigger of the two
 *    sweetness/ice numbers. This is the production-default recipe;
 *    Less / More / Free sugar and Less ice are handled at POS by
 *    modifier groups that adjust the ratios (not seeded here — the
 *    customizable percentages live in pos_settings).
 *
 * Bias intentionally conservative: only the *anchor* combination is
 * seeded so editors can extend without colliding with the seed.
 */

import { and, eq } from 'drizzle-orm';
import type { Database } from '../client';
import {
  bomLines,
  boms,
  productCategories,
  productVariants,
  products,
} from '../schema/inventory';

type LocaleString = { id: string; en: string; zh: string };

const n = (id: string, en: string, zh: string): LocaleString => ({ id, en, zh });

const RAW_MATERIALS = [
  {
    id: 'mat-tea-bamboo-oolong',
    code: 'TEA-BAMBOO-OOLONG',
    name: n('Teh Bamboo Oolong (seduh)', 'Bamboo Oolong tea brew', '竹叶乌龙茶汤'),
    uom: 'ml',
  },
  {
    id: 'mat-tea-osmanthus-oolong',
    code: 'TEA-OSMANTHUS-OOLONG',
    name: n('Teh Osmanthus Oolong (seduh)', 'Osmanthus Oolong tea brew', '桂花乌龙茶汤'),
    uom: 'ml',
  },
  {
    id: 'mat-tea-glutinous-green',
    code: 'TEA-GLUTINOUS-GREEN',
    name: n('Teh Hijau Ketan Wangi (seduh)', 'Glutinous Fragrant Green tea brew', '糯香绿茶茶汤'),
    uom: 'ml',
  },
  {
    id: 'mat-ice-sugar-syrup',
    code: 'SYRUP-ICE-SUGAR',
    name: n('Sirup gula es', 'Ice sugar syrup', '冰糖糖浆'),
    uom: 'ml',
  },
  {
    id: 'mat-basic-syrup',
    code: 'SYRUP-BASIC',
    name: n('Sirup gula dasar (fruktosa)', 'Basic fructose syrup', '基础果糖糖浆'),
    uom: 'ml',
  },
  {
    id: 'mat-creamer',
    code: 'CREAMER',
    name: n('Creamer (susu non-dairy)', 'Non-dairy creamer', '奶精'),
    uom: 'ml',
  },
  {
    id: 'mat-lemon',
    code: 'LEMON-FRESH',
    name: n('Lemon segar', 'Fresh lemon', '新鲜柠檬'),
    uom: 'g',
  },
  {
    id: 'mat-water',
    code: 'WATER-PURE',
    name: n('Air murni', 'Purified water', '纯净水'),
    uom: 'ml',
  },
] as const;

/**
 * Base teas used across all three beverage families. Code suffix indicates
 * the family-product combination, e.g. FT-BAMBOO for Fresh Tea + Bamboo.
 */
const BASE_TEAS = [
  { mat: 'mat-tea-bamboo-oolong', short: 'BAMBOO', label: 'Bamboo Oolong' },
  { mat: 'mat-tea-osmanthus-oolong', short: 'OSMANTHUS', label: 'Osmanthus Oolong' },
  { mat: 'mat-tea-glutinous-green', short: 'GLUTINOUS', label: 'Glutinous Fragrant Green' },
] as const;

const FAMILIES = [
  {
    id: 'FT',
    label: 'Fresh Tea',
    categoryCode: 'FRESH_TEA',
    /** Recipe (per cup size at standard sugar + standard ice). */
    recipe500: {
      tea: 200,
      iceSugarSyrup: 15,
      basicSyrup: 0,
      creamer: 0,
      lemon: 0,
      water: 60,
    },
    recipe700: {
      tea: 300,
      iceSugarSyrup: 25,
      basicSyrup: 0,
      creamer: 0,
      lemon: 0,
      water: 100,
    },
  },
  {
    id: 'LT',
    label: 'Lemon Tea',
    categoryCode: 'LEMON_FRESH_TEA',
    recipe500: {
      tea: 200,
      iceSugarSyrup: 10,
      basicSyrup: 20,
      creamer: 0,
      lemon: 40,
      water: 0,
    },
    recipe700: {
      tea: 300,
      iceSugarSyrup: 15,
      basicSyrup: 40,
      creamer: 0,
      lemon: 50,
      water: 0,
    },
  },
  {
    id: 'MT',
    label: 'Milk Tea',
    categoryCode: 'FRESH_MILK_TEA',
    recipe500: {
      tea: 200,
      iceSugarSyrup: 0,
      basicSyrup: 30,
      creamer: 50,
      lemon: 0,
      water: 0,
    },
    recipe700: {
      tea: 300,
      iceSugarSyrup: 0,
      basicSyrup: 40,
      creamer: 70,
      lemon: 0,
      water: 0,
    },
  },
] as const;

type Recipe = {
  tea: number;
  iceSugarSyrup: number;
  basicSyrup: number;
  creamer: number;
  lemon: number;
  water: number;
};

/** Suggested sell prices (IDR, rounded to 500). Editable post-seed. */
const PRICE = {
  FT: { '500ml': 17_000, '700ml': 22_000 },
  LT: { '500ml': 20_000, '700ml': 25_000 },
  MT: { '500ml': 22_000, '700ml': 28_000 },
} as const;

export async function seedRecipes(db: Database, tenantId: string) {
  // Get RAW_MATERIAL category ID
  const rawCat = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(and(eq(productCategories.tenantId, tenantId), eq(productCategories.code, 'RAW_MATERIAL')))
    .limit(1);
  const rawCategoryId = rawCat[0]?.id;

  if (!rawCategoryId) {
    throw new Error('RAW_MATERIAL category not found. Ensure menu is seeded first.');
  }

  // ── 1. Raw material products (ingredients) ──
  for (const raw of RAW_MATERIALS) {
    await db
      .insert(products)
      .values({
        id: raw.id,
        tenantId,
        sku: raw.code,
        name: raw.name,
        categoryId: rawCategoryId,
        kind: 'raw_material',
        uom: raw.uom,
        isActive: true,
        isSellable: false,
        isPurchasable: true,
        defaultSellPrice: 0n,
        defaultCostPrice: 0n,
      })
      .onConflictDoUpdate({
        target: products.id,
        set: {
          sku: raw.code,
          name: raw.name,
          categoryId: rawCategoryId,
          isActive: true,
          updatedAt: new Date(),
        },
      });
  }

  // ── 2. Finished-good products (3 families × 3 base teas) + variants ──
  for (const family of FAMILIES) {
    const [category] = await db
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.tenantId, tenantId),
          eq(productCategories.code, family.categoryCode),
        ),
      )
      .limit(1);

    for (const tea of BASE_TEAS) {
      const productId = `prod-${family.id.toLowerCase()}-${tea.short.toLowerCase()}`;
      const productSku = `${family.id}-${tea.short}`;
      const productName: LocaleString = n(
        `${tea.label} ${family.label}`,
        `${tea.label} ${family.label}`,
        `${tea.label} ${family.label}`,
      );

      await db
        .insert(products)
        .values({
          id: productId,
          tenantId,
          sku: productSku,
          name: productName,
          kind: 'finished_good',
          uom: 'cup',
          categoryId: category?.id ?? rawCategoryId, // fallback to raw
          isActive: true,
          isSellable: true,
          isPurchasable: false,
          defaultSellPrice: BigInt(PRICE[family.id]['700ml']),
          defaultCostPrice: 0n,
        })
        .onConflictDoUpdate({
          target: products.id,
          set: {
            sku: productSku,
            name: productName,
            categoryId: category?.id ?? rawCategoryId,
            isActive: true,
            updatedAt: new Date(),
          },
        });

      for (const cup of ['500ml', '700ml'] as const) {
        const variantId = `${productId}-${cup}`;
        const variantSku = `${productSku}-${cup.toUpperCase()}`;
        await db
          .insert(productVariants)
          .values({
            id: variantId,
            tenantId,
            productId,
            sku: variantSku,
            name: n(cup, cup, cup),
            sellPrice: BigInt(PRICE[family.id][cup]),
            costPrice: 0n,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: productVariants.id,
            set: {
              productId,
              sku: variantSku,
              name: n(cup, cup, cup),
              sellPrice: BigInt(PRICE[family.id][cup]),
              isActive: true,
              updatedAt: new Date(),
            },
          });

        // ── 3. BOM (anchor recipe = standard ice + standard sugar) ──
        const bomId = `bom-${variantId}`;
        const recipe: Recipe = cup === '500ml' ? family.recipe500 : family.recipe700;
        await db
          .insert(boms)
          .values({
            id: bomId,
            tenantId,
            productId,
            variantId,
            bomVersion: 1,
            description: `${tea.label} ${family.label} ${cup} — standard sugar + standard ice`,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: boms.id,
            set: {
              productId,
              variantId,
              isActive: true,
              updatedAt: new Date(),
            },
          });

        const bomLineRows: Array<{ ingredientId: string; qty: number; uom: string }> = [];
        bomLineRows.push({ ingredientId: tea.mat, qty: recipe.tea, uom: 'ml' });
        if (recipe.iceSugarSyrup > 0)
          bomLineRows.push({
            ingredientId: 'mat-ice-sugar-syrup',
            qty: recipe.iceSugarSyrup,
            uom: 'ml',
          });
        if (recipe.basicSyrup > 0)
          bomLineRows.push({
            ingredientId: 'mat-basic-syrup',
            qty: recipe.basicSyrup,
            uom: 'ml',
          });
        if (recipe.creamer > 0)
          bomLineRows.push({
            ingredientId: 'mat-creamer',
            qty: recipe.creamer,
            uom: 'ml',
          });
        if (recipe.lemon > 0)
          bomLineRows.push({
            ingredientId: 'mat-lemon',
            qty: recipe.lemon,
            uom: 'g',
          });
        if (recipe.water > 0)
          bomLineRows.push({
            ingredientId: 'mat-water',
            qty: recipe.water,
            uom: 'ml',
          });

        for (let i = 0; i < bomLineRows.length; i++) {
          const row = bomLineRows[i]!;
          await db
            .insert(bomLines)
            .values({
              id: `${bomId}-${i + 1}`,
              bomId,
              lineNo: i + 1,
              ingredientId: row.ingredientId,
              qty: String(row.qty),
              uom: row.uom,
              isOptional: false,
            })
            .onConflictDoUpdate({
              target: bomLines.id,
              set: {
                bomId,
                lineNo: i + 1,
                ingredientId: row.ingredientId,
                qty: String(row.qty),
                uom: row.uom,
                updatedAt: new Date(),
              },
            });
        }
      }
    }
  }
}
