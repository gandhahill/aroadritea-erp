/**
 * Aroadri Tea menu bootstrap seed.
 *
 * Source: user-provided in-store menu photos and product list, 2026-05-14.
 * Seeded rows remain editable from ERP/POS after bootstrap.
 */

import { and, eq } from 'drizzle-orm';
import type { Database } from '../client';
import {
  productCategories,
  productModifierGroups,
  productModifierLinks,
  productModifierOptions,
  productVariants,
  products,
} from '../schema/inventory';

type LocaleString = { id: string; en: string; zh: string };
type Temperature = 'cold' | 'hot';

const n = (id: string, en: string, zh: string): LocaleString => ({ id, en, zh });
const money = (value: number) => BigInt(value);

const CATEGORIES = [
  { id: 'cat-tea', code: 'TEA', name: n('Teh', 'Tea', '茶饮'), parentCode: null, sortOrder: 10 },
  {
    id: 'cat-fresh-milk-tea',
    code: 'FRESH_MILK_TEA',
    name: n('Fresh Milk Tea', 'Fresh Milk Tea', '鲜奶茶'),
    parentCode: 'TEA',
    sortOrder: 11,
  },
  {
    id: 'cat-fresh-tea',
    code: 'FRESH_TEA',
    name: n('Fresh Tea', 'Fresh Tea', '鲜茶'),
    parentCode: 'TEA',
    sortOrder: 12,
  },
  {
    id: 'cat-lemon-fresh-tea',
    code: 'LEMON_FRESH_TEA',
    name: n('Lemon Fresh Tea', 'Lemon Fresh Tea', '柠檬鲜茶'),
    parentCode: 'TEA',
    sortOrder: 13,
  },
  {
    id: 'cat-snow-cap-milk-tea',
    code: 'SNOW_CAP_MILK_TEA',
    name: n('Snow Cap Milk Tea', 'Snow Cap Milk Tea', '雪顶奶茶'),
    parentCode: 'TEA',
    sortOrder: 14,
  },
  {
    id: 'cat-dessert',
    code: 'DESSERT',
    name: n('Dessert', 'Dessert', '甜品'),
    parentCode: null,
    sortOrder: 20,
  },
  {
    id: 'cat-raw-material',
    code: 'RAW_MATERIAL',
    name: n('Bahan Baku', 'Raw Material', '原材料'),
    parentCode: null,
    sortOrder: 99,
  },
] as const;

type CategoryCode = (typeof CATEGORIES)[number]['code'];

interface MenuProduct {
  sku: string;
  categoryCode: CategoryCode;
  name: LocaleString;
  description: LocaleString;
  regular?: number;
  large?: number;
  single?: number;
  temperatures?: Temperature[];
}

const categoryDescriptions: Record<CategoryCode, LocaleString> = {
  TEA: n(
    'Kategori induk teh Aroadri Tea.',
    'Aroadri Tea parent tea category.',
    'Aroadri Tea 茶饮主分类。',
  ),
  FRESH_MILK_TEA: n(
    'Fresh milk tea berbasis teh ala Tiongkok.',
    'Chinese-style fresh milk tea.',
    '中式鲜奶茶。',
  ),
  FRESH_TEA: n('Fresh tea tanpa susu.', 'Milk-free fresh tea.', '无奶鲜茶。'),
  LEMON_FRESH_TEA: n('Fresh tea dengan lemon.', 'Fresh tea with lemon.', '柠檬鲜茶。'),
  SNOW_CAP_MILK_TEA: n('Milk tea dengan snow cap.', 'Milk tea with snow cap.', '雪顶奶茶。'),
  DESSERT: n('Dessert pendamping teh.', 'Tea-pairing dessert.', '茶饮甜品搭配。'),
  RAW_MATERIAL: n('Bahan baku dan ingredien.', 'Raw materials and ingredients.', '原材料。'),
};

const MENU_PRODUCTS: MenuProduct[] = [
  tea('FMT-BOO', 'FRESH_MILK_TEA', 'Bamboo Oolong Milk Tea', '竹香乌龙奶茶', 42000, 47000, [
    'cold',
    'hot',
  ]),
  tea('FMT-OSM', 'FRESH_MILK_TEA', 'Osmanthus Oolong Milk Tea', '桂花乌龙奶茶', 42000, 47000, [
    'cold',
    'hot',
  ]),
  tea(
    'FMT-GLU',
    'FRESH_MILK_TEA',
    'Glutinous Fragrant Green Milk Tea',
    '糯香绿奶茶',
    43000,
    49000,
    ['cold', 'hot'],
  ),
  tea('FMT-JAS', 'FRESH_MILK_TEA', 'Jasmine Green Milk Tea', '茉莉绿奶茶', 43000, 49000, [
    'cold',
    'hot',
  ]),
  tea('FMT-CEY', 'FRESH_MILK_TEA', 'Ceylon Black Milk Tea', '锡兰红奶茶', 42000, 47000, [
    'cold',
    'hot',
  ]),
  tea(
    'FMT-ROY',
    'FRESH_MILK_TEA',
    'Roasted Fragrant Yellow Milk Tea',
    '焙香黄茶奶茶',
    43000,
    49000,
    ['cold', 'hot'],
  ),
  tea('FT-BOO', 'FRESH_TEA', 'Bamboo Oolong Fresh Tea', '竹香乌龙鲜茶', 32000, 42000, [
    'cold',
    'hot',
  ]),
  tea(
    'FT-OSM',
    'FRESH_TEA',
    'Osmanthus Oolong Fresh Tea',
    '桂花乌龙鲜茶',
    32000,
    42000,
    ['cold', 'hot'],
  ),
  tea('FT-JAS', 'FRESH_TEA', 'Jasmine Green Fresh Tea', '茉莉绿鲜茶', 33000, 43000, [
    'cold',
    'hot',
  ]),
  tea('FT-CEY', 'FRESH_TEA', 'Ceylon Black Fresh Tea', '锡兰红鲜茶', 33000, 43000, [
    'cold',
    'hot',
  ]),
  tea('FT-ROY', 'FRESH_TEA', 'Roasted Fragrant Yellow Fresh Tea', '焙香黄鲜茶', 32000, 42000, [
    'cold',
    'hot',
  ]),
  tea(
    'FT-GLU',
    'FRESH_TEA',
    'Glutinous Fragrant Green Fresh Tea',
    '糯香绿鲜茶',
    33000,
    43000,
    ['cold', 'hot'],
  ),
  tea(
    'FT-BIL',
    'FRESH_TEA',
    'Buckwheat Biluochun Fresh Tea',
    '荞麦碧螺春鲜茶',
    35000,
    45000,
    ['cold', 'hot'],
  ),
  tea(
    'LFT-GLU',
    'LEMON_FRESH_TEA',
    'Glutinous Fragrant Green Lemon Tea',
    '糯香绿柠檬茶',
    43000,
    47000,
    ['cold'],
  ),
  tea('LFT-BOO', 'LEMON_FRESH_TEA', 'Bamboo Oolong Lemon Tea', '竹香乌龙柠檬茶', 43000, 47000, [
    'cold',
  ]),
  tea('LFT-OSM', 'LEMON_FRESH_TEA', 'Osmanthus Oolong Lemon Tea', '桂花乌龙柠檬茶', 43000, 47000, [
    'cold',
  ]),
  tea(
    'LFT-ROY',
    'LEMON_FRESH_TEA',
    'Roasted Fragrant Yellow Lemon Tea',
    '焙香黄茶柠檬茶',
    45000,
    49000,
    ['cold'],
  ),
  tea('LFT-JAS', 'LEMON_FRESH_TEA', 'Jasmine Green Lemon Tea', '茉莉绿柠檬茶', 43000, 47000, [
    'cold',
  ]),
  tea(
    'LFT-BIL',
    'LEMON_FRESH_TEA',
    'Buckwheat Biluochun Lemon Tea',
    '荞麦碧螺春柠檬茶',
    45000,
    49000,
    ['cold'],
  ),
  single(
    'SCM-BOO',
    'SNOW_CAP_MILK_TEA',
    'Bamboo Oolong Snow Cap Milk Tea',
    '竹香乌龙雪顶奶茶',
    56000,
  ),
  single(
    'SCM-OSM',
    'SNOW_CAP_MILK_TEA',
    'Osmanthus Oolong Snow Cap Milk Tea',
    '桂花乌龙雪顶奶茶',
    56000,
  ),
  dessert('DST-EGG-TART', 'Egg Tart', '蛋挞'),
  dessert('DST-FANCY-EGG-TART', 'Fancy Egg Tart', '精品蛋挞'),
  dessert('DST-PUDDING-BAMBOO', 'Bamboo Oolong Pudding', '竹香乌龙布丁'),
  dessert('DST-PUDDING-OSMANTHUS', 'Osmanthus Oolong Pudding', '桂花乌龙布丁'),
  dessert('DST-PUDDING-CEYLON', 'Ceylon Black Pudding', '锡兰红茶布丁'),
  dessert('DST-PUDDING-ROY', 'Roasted Fragrant Yellow Pudding', '焙香黄茶布丁'),
];

const PRODUCT_IMAGE_URLS: Record<string, string> = {
  'FMT-BOO': '/photo/menu/bamboo-oolong-milk-tea.jpg',
  'FMT-OSM': '/photo/menu/osmanthus-oolong-milk-tea.jpg',
  'FMT-GLU': '/photo/menu/glutinous-fragrant-milk-tea.jpg',
  'FMT-JAS': '/photo/menu/jasmine-green-milk-tea.jpg',
  'FMT-CEY': '/photo/menu/ceylon-black-milk-tea.jpg',
  'FMT-ROY': '/photo/menu/roasted-fragrant-yellow-milk-tea.jpg',
  // Fresh Tea line intentionally shares a single photo per the menu board
  // layout (the brand groups them under one collective image).
  'FT-BOO': '/photo/menu/fresh-tea.jpg',
  'FT-OSM': '/photo/menu/fresh-tea.jpg',
  'FT-JAS': '/photo/menu/fresh-tea.jpg',
  'FT-CEY': '/photo/menu/fresh-tea.jpg',
  'FT-ROY': '/photo/menu/fresh-tea.jpg',
  'FT-GLU': '/photo/menu/fresh-tea.jpg',
  'FT-BIL': '/photo/menu/fresh-tea.jpg',
  'LFT-GLU': '/photo/menu/glutinous-fragrant-lemon-tea.jpg',
  'LFT-BOO': '/photo/menu/bamboo-oolong-lemon-tea.jpg',
  'LFT-OSM': '/photo/menu/osmanthus-oolong-lemon-tea.jpg',
  'LFT-ROY': '/photo/menu/roasted-fragrant-yellow-lemon-tea.jpg',
  'LFT-JAS': '/photo/menu/jasmine-green-lemon-tea.jpg',
  'LFT-BIL': '/photo/menu/buckwheat-biluochun-lemon-tea.jpg',
  'SCM-BOO': '/photo/menu/snow-cap-bamboo.jpg',
  'SCM-OSM': '/photo/menu/snow-cap-osmanthus.jpg',
  'DST-EGG-TART': '/photo/menu/egg-tart.jpg',
  // Fancy Egg Tart uses the same photo as regular Egg Tart per the user
  // request — both desserts share the same visual treatment on the menu
  // board and the brand has not yet provided a unique studio photo.
  'DST-FANCY-EGG-TART': '/photo/menu/egg-tart.jpg',
  // Pudding flavours each get their own photo from the brand-supplied
  // source folder. Products without official source photos are not
  // bootstrapped here to avoid public/menu placeholders.
  'DST-PUDDING-BAMBOO': '/photo/menu/pudding-bamboo.jpg',
  'DST-PUDDING-OSMANTHUS': '/photo/menu/pudding-osmanthus.jpg',
  'DST-PUDDING-CEYLON': '/photo/menu/pudding-ceylon.jpg',
  'DST-PUDDING-ROY': '/photo/menu/pudding-roasted-yellow.jpg',
};

const MODIFIER_GROUPS = [
  {
    id: 'modgrp-sugar-level',
    name: n('Level Gula', 'Sugar Level', '糖度'),
    selectionType: 'single',
    isRequired: true,
    maxSelections: 1,
    sortOrder: 10,
    options: [
      option('modopt-sugar-normal', 'Normal Sugar', '正常糖', 0, true, 10),
      option('modopt-sugar-less', 'Less Sugar', '少糖', 0, false, 20),
      option('modopt-sugar-none', 'No Sugar', '无糖', 0, false, 30),
    ],
  },
  {
    id: 'modgrp-ice-level',
    name: n('Level Es', 'Ice Level', '冰量'),
    selectionType: 'single',
    isRequired: true,
    maxSelections: 1,
    sortOrder: 20,
    options: [
      option('modopt-ice-normal', 'Normal Ice', '正常冰', 0, true, 10),
      option('modopt-ice-less', 'Less Ice', '少冰', 0, false, 20),
      option('modopt-ice-none', 'No Ice', '去冰', 0, false, 30),
    ],
  },
  {
    id: 'modgrp-topping',
    name: n('Topping', 'Topping', '配料'),
    selectionType: 'multiple',
    isRequired: false,
    maxSelections: 4,
    sortOrder: 30,
    options: [
      option('modopt-topping-cheese-pearl', 'Cheese Pearl', '芝士珍珠', 5000, false, 10),
      option('modopt-topping-oat-pearl', 'Oat Pearl', '燕麦珍珠', 5000, false, 20),
      option('modopt-topping-crystal-pearl', 'Crystal Pearl', '水晶珍珠', 5000, false, 30),
      option('modopt-topping-barley-pearl', 'Barley Pearl', '大麦珍珠', 5000, false, 40),
    ],
  },
] as const;

export async function seedMenu(db: Database, tenantId: string) {
  const categoryIds = new Map<string, string>();

  for (const category of CATEGORIES) {
    const parentId = category.parentCode ? categoryIds.get(category.parentCode) : null;
    await db
      .insert(productCategories)
      .values({
        id: category.id,
        tenantId,
        code: category.code,
        name: category.name,
        parentId,
        sortOrder: category.sortOrder,
      })
      .onConflictDoUpdate({
        target: [productCategories.tenantId, productCategories.code],
        set: {
          name: category.name,
          parentId,
          sortOrder: category.sortOrder,
          isActive: true,
          updatedAt: new Date(),
        },
      });

    const row = await db
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(
        and(eq(productCategories.tenantId, tenantId), eq(productCategories.code, category.code)),
      )
      .limit(1);
    categoryIds.set(category.code, row[0]?.id ?? category.id);
  }

  const teaProductIds: string[] = [];

  for (const product of MENU_PRODUCTS) {
    const id = productId(product.sku);
    const categoryId = categoryIds.get(product.categoryCode);
    if (!categoryId) continue;

    const defaultSellPrice = product.single ?? product.regular ?? 0;
    const isTeaDrink = product.categoryCode !== 'DESSERT';
    const imageUrl = PRODUCT_IMAGE_URLS[product.sku] ?? null;

    await db
      .insert(products)
      .values({
        id,
        tenantId,
        sku: product.sku,
        name: product.name,
        description: product.description,
        imageUrl,
        categoryId,
        kind: 'finished_good',
        uom: 'pcs',
        isSellable: true,
        isPurchasable: false,
        defaultSellPrice: money(defaultSellPrice),
        taxCode: 'PB1',
      })
      .onConflictDoUpdate({
        target: [products.tenantId, products.sku],
        set: {
          name: product.name,
          description: product.description,
          imageUrl,
          categoryId,
          isSellable: true,
          isPurchasable: false,
          defaultSellPrice: money(defaultSellPrice),
          taxCode: 'PB1',
          isActive: true,
          updatedAt: new Date(),
        },
      });

    const productRow = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.sku, product.sku)))
      .limit(1);
    const actualProductId = productRow[0]?.id ?? id;
    if (isTeaDrink) teaProductIds.push(actualProductId);

    for (const variant of createVariants(product, actualProductId)) {
      await db
        .insert(productVariants)
        .values({
          id: variant.id,
          tenantId,
          productId: actualProductId,
          sku: variant.sku,
          name: variant.name,
          sellPrice: money(variant.sellPrice),
          attributes: variant.attributes,
          sortOrder: variant.sortOrder,
        })
        .onConflictDoUpdate({
          target: [productVariants.tenantId, productVariants.sku],
          set: {
            productId: actualProductId,
            name: variant.name,
            sellPrice: money(variant.sellPrice),
            attributes: variant.attributes,
            sortOrder: variant.sortOrder,
            isActive: true,
            updatedAt: new Date(),
          },
        });
    }
  }

  for (const group of MODIFIER_GROUPS) {
    await db
      .insert(productModifierGroups)
      .values({
        id: group.id,
        tenantId,
        name: group.name,
        selectionType: group.selectionType,
        isRequired: group.isRequired,
        maxSelections: group.maxSelections,
        sortOrder: group.sortOrder,
      })
      .onConflictDoUpdate({
        target: productModifierGroups.id,
        set: {
          name: group.name,
          selectionType: group.selectionType,
          isRequired: group.isRequired,
          maxSelections: group.maxSelections,
          sortOrder: group.sortOrder,
          isActive: true,
          updatedAt: new Date(),
        },
      });

    for (const modifierOption of group.options) {
      await db
        .insert(productModifierOptions)
        .values({
          id: modifierOption.id,
          tenantId,
          groupId: group.id,
          name: modifierOption.name,
          extraPrice: money(modifierOption.extraPrice),
          isDefault: modifierOption.isDefault,
          sortOrder: modifierOption.sortOrder,
        })
        .onConflictDoUpdate({
          target: productModifierOptions.id,
          set: {
            groupId: group.id,
            name: modifierOption.name,
            extraPrice: money(modifierOption.extraPrice),
            isDefault: modifierOption.isDefault,
            sortOrder: modifierOption.sortOrder,
            isActive: true,
            updatedAt: new Date(),
          },
        });
    }
  }

  for (const currentProductId of teaProductIds) {
    for (const group of MODIFIER_GROUPS) {
      await db
        .insert(productModifierLinks)
        .values({
          id: `modlink-${currentProductId}-${group.id}`,
          productId: currentProductId,
          modifierGroupId: group.id,
          sortOrder: group.sortOrder,
        })
        .onConflictDoNothing();
    }
  }

  return {
    categories: CATEGORIES.length,
    products: MENU_PRODUCTS.length,
    modifierGroups: MODIFIER_GROUPS.length,
  };
}

function tea(
  sku: string,
  categoryCode: CategoryCode,
  englishName: string,
  zhName: string,
  regular: number,
  large: number,
  temperatures: Temperature[],
): MenuProduct {
  return {
    sku,
    categoryCode,
    name: n(englishName, englishName, zhName),
    description: categoryDescriptions[categoryCode],
    regular,
    large,
    temperatures,
  };
}

function single(
  sku: string,
  categoryCode: CategoryCode,
  englishName: string,
  zhName: string,
  price: number,
): MenuProduct {
  return {
    sku,
    categoryCode,
    name: n(englishName, englishName, zhName),
    description: categoryDescriptions[categoryCode],
    single: price,
    temperatures: ['cold'],
  };
}

function dessert(sku: string, englishName: string, zhName: string): MenuProduct {
  return {
    sku,
    categoryCode: 'DESSERT',
    name: n(englishName, englishName, zhName),
    description: categoryDescriptions.DESSERT,
  };
}

function option(
  id: string,
  englishName: string,
  zhName: string,
  extraPrice: number,
  isDefault: boolean,
  sortOrder: number,
) {
  return {
    id,
    name: n(englishName, englishName, zhName),
    extraPrice,
    isDefault,
    sortOrder,
  };
}

function createVariants(product: MenuProduct, currentProductId: string) {
  const temperatures = product.temperatures ?? [];

  if (product.single) {
    return temperatures.map((temperature, index) => ({
      id: `${currentProductId}-${temperature}`,
      sku: `${product.sku}-${temperature.toUpperCase()}`,
      name: variantName('One Size', temperature),
      sellPrice: product.single as number,
      attributes: { size: 'one_size', temperature },
      sortOrder: index + 1,
    }));
  }

  const rows: Array<{
    id: string;
    sku: string;
    name: LocaleString;
    sellPrice: number;
    attributes: Record<string, string>;
    sortOrder: number;
  }> = [];
  const sizes = [
    { code: 'regular', label: 'Regular', price: product.regular },
    { code: 'large', label: 'Large', price: product.large },
  ].filter((size): size is { code: string; label: string; price: number } => Boolean(size.price));

  let sortOrder = 1;
  for (const size of sizes) {
    for (const temperature of temperatures) {
      rows.push({
        id: `${currentProductId}-${size.code}-${temperature}`,
        sku: `${product.sku}-${size.code.toUpperCase()}-${temperature.toUpperCase()}`,
        name: variantName(size.label, temperature),
        sellPrice: size.price,
        attributes: { size: size.code, temperature },
        sortOrder,
      });
      sortOrder++;
    }
  }

  return rows;
}

function productId(sku: string) {
  return `prd-${sku.toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')}`;
}

function variantName(size: string, temperature: Temperature): LocaleString {
  const temperatureId = temperature === 'cold' ? 'Dingin' : 'Panas';
  const temperatureEn = temperature === 'cold' ? 'Cold' : 'Hot';
  const temperatureZh = temperature === 'cold' ? '冷' : '热';
  return n(`${size} ${temperatureId}`, `${size} ${temperatureEn}`, `${size} ${temperatureZh}`);
}
