/**
 * Naixer KDS Settings — Server Actions (SD §33.7, ADR-0007)
 * CRUD for product codes, modifier codes, and QR format config.
 */

'use server';

import { getSession } from '@/lib/auth';
import { pickLocalized } from '@/lib/pick-localized';
import { and, db, eq, inArray } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import {
  naixerModifierCodes,
  naixerProductCodes,
  naixerQrFormatConfig,
} from '@erp/db/schema/kitchen';
import {
  productModifierGroups,
  productModifierOptions,
  productVariants,
  products,
} from '@erp/db/schema/inventory';
import { dashStrategy, pipeStrategy } from '@erp/services/kitchen';
import { generateId } from '@erp/shared/id';
import { getLocale } from 'next-intl/server';
import QRCode from 'qrcode';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProductCodeItem {
  id: string;
  productId: string;
  productLabel: string;
  variantId: string | null;
  variantLabel: string | null;
  naixerCode: string;
  isActive: boolean;
}

export interface NaixerProductOption {
  id: string;
  sku: string;
  label: string;
}

export interface NaixerVariantOption {
  id: string;
  productId: string;
  sku: string;
  label: string;
}

export interface ModifierCodeItem {
  id: string;
  modifierKind: string;
  modifierOptionId: string;
  modifierOptionLabel: string;
  naixerCode: string;
  displayOrder: number;
  isActive: boolean;
}

export interface NaixerModifierOption {
  id: string;
  groupName: string;
  label: string;
}

export interface FormatConfigItem {
  id: string;
  locationId: string;
  locationName: string;
  format: string;
  includeOrderId: boolean;
  parameterOrderJson: string[];
  labelWidthMm: number;
  labelHeightMm: number;
  isActive: boolean;
}

type ActionResult = { success: boolean; error?: string };

async function getSessionTenantId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  return (((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default') || null;
}

async function canAccessTenant(tenantId: string): Promise<boolean> {
  const currentTenantId = await getSessionTenantId();
  return currentTenantId === tenantId;
}

// ─── Product Codes ──────────────────────────────────────────────────────────

export async function fetchProductCodes(tenantId: string): Promise<ProductCodeItem[]> {
  if (!(await canAccessTenant(tenantId))) return [];
  const locale = await getLocale();
  const [rows, productRows, variantRows] = await Promise.all([
    db
      .select({
        id: naixerProductCodes.id,
        productId: naixerProductCodes.productId,
        variantId: naixerProductCodes.variantId,
        naixerCode: naixerProductCodes.naixerCode,
        isActive: naixerProductCodes.isActive,
      })
      .from(naixerProductCodes)
      .where(eq(naixerProductCodes.tenantId, tenantId))
      .orderBy(naixerProductCodes.naixerCode),
    db
      .select({ id: products.id, sku: products.sku, name: products.name })
      .from(products)
      .where(eq(products.tenantId, tenantId)),
    db
      .select({ id: productVariants.id, sku: productVariants.sku, name: productVariants.name })
      .from(productVariants)
      .where(eq(productVariants.tenantId, tenantId)),
  ]);
  const productMap = new Map(
    productRows.map((p) => [
      p.id,
      `${p.sku} — ${pickLocalized(p.name, locale, p.sku)}`,
    ] as const),
  );
  const variantMap = new Map(
    variantRows.map((v) => [
      v.id,
      `${v.sku} — ${pickLocalized(v.name, locale, v.sku)}`,
    ] as const),
  );
  return rows.map((r) => ({
    ...r,
    productLabel: productMap.get(r.productId) ?? r.productId,
    variantLabel: r.variantId ? (variantMap.get(r.variantId) ?? r.variantId) : null,
  }));
}

export async function fetchNaixerProductOptions(
  tenantId: string,
): Promise<{ products: NaixerProductOption[]; variants: NaixerVariantOption[] }> {
  if (!(await canAccessTenant(tenantId))) return { products: [], variants: [] };
  const locale = await getLocale();
  const [productRows, variantRows] = await Promise.all([
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        isActive: products.isActive,
      })
      .from(products)
      .where(eq(products.tenantId, tenantId))
      .orderBy(products.sku),
    db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        sku: productVariants.sku,
        name: productVariants.name,
        isActive: productVariants.isActive,
      })
      .from(productVariants)
      .where(eq(productVariants.tenantId, tenantId))
      .orderBy(productVariants.sku),
  ]);
  return {
    products: productRows
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        sku: p.sku,
        label: `${p.sku} — ${pickLocalized(p.name, locale, p.sku)}`,
      })),
    variants: variantRows
      .filter((v) => v.isActive)
      .map((v) => ({
        id: v.id,
        productId: v.productId,
        sku: v.sku,
        label: `${v.sku} — ${pickLocalized(v.name, locale, v.sku)}`,
      })),
  };
}

export async function createProductCode(
  tenantId: string,
  data: { productId: string; variantId?: string; naixerCode: string },
): Promise<ActionResult> {
  try {
    if (!(await canAccessTenant(tenantId))) return { success: false, error: 'Forbidden' };
    if (!data.productId || !data.naixerCode) {
      return { success: false, error: 'Product ID and Naixer code are required' };
    }
    await db.insert(naixerProductCodes).values({
      id: generateId(),
      tenantId,
      productId: data.productId,
      variantId: data.variantId || null,
      naixerCode: data.naixerCode.trim(),
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { success: false, error: 'This product/variant mapping already exists' };
    }
    return { success: false, error: msg };
  }
}

export async function updateProductCode(
  id: string,
  data: { naixerCode?: string; isActive?: boolean },
): Promise<ActionResult> {
  try {
    const tenantId = await getSessionTenantId();
    if (!tenantId) return { success: false, error: 'Unauthenticated' };
    const [current] = await db
      .select({ tenantId: naixerProductCodes.tenantId })
      .from(naixerProductCodes)
      .where(eq(naixerProductCodes.id, id))
      .limit(1);
    if (!current || current.tenantId !== tenantId) return { success: false, error: 'Not found' };

    const result = await db
      .update(naixerProductCodes)
      .set({
        ...(data.naixerCode !== undefined && { naixerCode: data.naixerCode.trim() }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(naixerProductCodes.id, id))
      .returning({ id: naixerProductCodes.id });

    if (result.length === 0) return { success: false, error: 'Not found' };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function deleteProductCode(id: string): Promise<ActionResult> {
  try {
    const tenantId = await getSessionTenantId();
    if (!tenantId) return { success: false, error: 'Unauthenticated' };
    const [current] = await db
      .select({ tenantId: naixerProductCodes.tenantId })
      .from(naixerProductCodes)
      .where(eq(naixerProductCodes.id, id))
      .limit(1);
    if (!current || current.tenantId !== tenantId) return { success: false, error: 'Not found' };

    const result = await db
      .delete(naixerProductCodes)
      .where(eq(naixerProductCodes.id, id))
      .returning({ id: naixerProductCodes.id });
    if (result.length === 0) return { success: false, error: 'Not found' };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ─── Modifier Codes ─────────────────────────────────────────────────────────

export async function fetchModifierCodes(tenantId: string): Promise<ModifierCodeItem[]> {
  if (!(await canAccessTenant(tenantId))) return [];
  const locale = await getLocale();
  const [rows, optionRows] = await Promise.all([
    db
      .select({
        id: naixerModifierCodes.id,
        modifierKind: naixerModifierCodes.modifierKind,
        modifierOptionId: naixerModifierCodes.modifierOptionId,
        naixerCode: naixerModifierCodes.naixerCode,
        displayOrder: naixerModifierCodes.displayOrder,
        isActive: naixerModifierCodes.isActive,
      })
      .from(naixerModifierCodes)
      .where(eq(naixerModifierCodes.tenantId, tenantId))
      .orderBy(naixerModifierCodes.modifierKind, naixerModifierCodes.displayOrder),
    db
      .select({ id: productModifierOptions.id, name: productModifierOptions.name })
      .from(productModifierOptions)
      .where(eq(productModifierOptions.tenantId, tenantId)),
  ]);
  const optMap = new Map(
    optionRows.map((o) => [o.id, pickLocalized(o.name, locale, o.id)] as const),
  );
  return rows.map((r) => ({
    ...r,
    modifierOptionLabel: optMap.get(r.modifierOptionId) ?? r.modifierOptionId,
  }));
}

export async function fetchNaixerModifierOptions(
  tenantId: string,
): Promise<NaixerModifierOption[]> {
  if (!(await canAccessTenant(tenantId))) return [];
  const locale = await getLocale();
  const rows = await db
    .select({
      id: productModifierOptions.id,
      optName: productModifierOptions.name,
      groupName: productModifierGroups.name,
    })
    .from(productModifierOptions)
    .leftJoin(
      productModifierGroups,
      and(
        eq(productModifierOptions.groupId, productModifierGroups.id),
        eq(productModifierGroups.tenantId, tenantId),
      ),
    )
    .where(eq(productModifierOptions.tenantId, tenantId))
    .orderBy(productModifierOptions.sortOrder);
  return rows.map((r) => ({
    id: r.id,
    groupName: pickLocalized(r.groupName, locale, ''),
    label: `${pickLocalized(r.groupName, locale, '')} · ${pickLocalized(r.optName, locale, r.id)}`,
  }));
}

export async function createModifierCode(
  tenantId: string,
  data: {
    modifierKind: string;
    modifierOptionId: string;
    naixerCode: string;
    displayOrder?: number;
  },
): Promise<ActionResult> {
  try {
    if (!(await canAccessTenant(tenantId))) return { success: false, error: 'Forbidden' };
    if (!data.modifierKind || !data.modifierOptionId || !data.naixerCode) {
      return { success: false, error: 'All fields are required' };
    }
    await db.insert(naixerModifierCodes).values({
      id: generateId(),
      tenantId,
      modifierKind: data.modifierKind,
      modifierOptionId: data.modifierOptionId,
      naixerCode: data.naixerCode.trim(),
      displayOrder: data.displayOrder ?? 0,
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { success: false, error: 'This modifier option mapping already exists' };
    }
    return { success: false, error: msg };
  }
}

export async function updateModifierCode(
  id: string,
  data: { naixerCode?: string; displayOrder?: number; isActive?: boolean },
): Promise<ActionResult> {
  try {
    const tenantId = await getSessionTenantId();
    if (!tenantId) return { success: false, error: 'Unauthenticated' };
    const [current] = await db
      .select({ tenantId: naixerModifierCodes.tenantId })
      .from(naixerModifierCodes)
      .where(eq(naixerModifierCodes.id, id))
      .limit(1);
    if (!current || current.tenantId !== tenantId) return { success: false, error: 'Not found' };

    const result = await db
      .update(naixerModifierCodes)
      .set({
        ...(data.naixerCode !== undefined && { naixerCode: data.naixerCode.trim() }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(naixerModifierCodes.id, id))
      .returning({ id: naixerModifierCodes.id });

    if (result.length === 0) return { success: false, error: 'Not found' };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function deleteModifierCode(id: string): Promise<ActionResult> {
  try {
    const tenantId = await getSessionTenantId();
    if (!tenantId) return { success: false, error: 'Unauthenticated' };
    const [current] = await db
      .select({ tenantId: naixerModifierCodes.tenantId })
      .from(naixerModifierCodes)
      .where(eq(naixerModifierCodes.id, id))
      .limit(1);
    if (!current || current.tenantId !== tenantId) return { success: false, error: 'Not found' };

    const result = await db
      .delete(naixerModifierCodes)
      .where(eq(naixerModifierCodes.id, id))
      .returning({ id: naixerModifierCodes.id });
    if (result.length === 0) return { success: false, error: 'Not found' };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ─── Format Config ──────────────────────────────────────────────────────────

export async function fetchFormatConfigs(tenantId: string): Promise<FormatConfigItem[]> {
  if (!(await canAccessTenant(tenantId))) return [];
  const locs = await db
    .select({ id: locations.id, name: locations.name, code: locations.code })
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, tenantId),
        eq(locations.status, 'active'),
        eq(locations.type, 'store'),
      ),
    );
  const locationIds = locs.map((loc) => loc.id);

  if (locationIds.length === 0) return [];

  const configs = await db
    .select({
      id: naixerQrFormatConfig.id,
      locationId: naixerQrFormatConfig.locationId,
      format: naixerQrFormatConfig.format,
      includeOrderId: naixerQrFormatConfig.includeOrderId,
      parameterOrderJson: naixerQrFormatConfig.parameterOrderJson,
      labelWidthMm: naixerQrFormatConfig.labelWidthMm,
      labelHeightMm: naixerQrFormatConfig.labelHeightMm,
      isActive: naixerQrFormatConfig.isActive,
    })
    .from(naixerQrFormatConfig)
    .where(inArray(naixerQrFormatConfig.locationId, locationIds));

  const locMap = new Map<string, string>();
  for (const l of locs) {
    const nameObj = l.name as { id?: string; en?: string } | null;
    locMap.set(l.id, nameObj?.id ?? nameObj?.en ?? l.code);
  }

  return configs.map((c) => ({
    ...c,
    locationName: locMap.get(c.locationId) ?? c.locationId,
    parameterOrderJson: (c.parameterOrderJson ?? []) as string[],
  }));
}

export async function updateFormatConfig(
  id: string,
  data: {
    format?: string;
    includeOrderId?: boolean;
    parameterOrderJson?: string[];
    labelWidthMm?: number;
    labelHeightMm?: number;
    isActive?: boolean;
  },
): Promise<ActionResult> {
  const tenantId = await getSessionTenantId();
  if (!tenantId) return { success: false, error: 'Unauthenticated' };

  const allowedLocations = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, tenantId),
        eq(locations.status, 'active'),
        eq(locations.type, 'store'),
      ),
    );
  const allowedLocationIds = new Set(allowedLocations.map((loc) => loc.id));

  const [current] = await db
    .select({ locationId: naixerQrFormatConfig.locationId })
    .from(naixerQrFormatConfig)
    .where(eq(naixerQrFormatConfig.id, id))
    .limit(1);

  if (!current || !allowedLocationIds.has(current.locationId)) {
    return { success: false, error: 'Not found' };
  }

  if (data.labelWidthMm !== undefined && (data.labelWidthMm < 30 || data.labelWidthMm > 100)) {
    return { success: false, error: 'Label width must be between 30 and 100 mm' };
  }
  if (data.labelHeightMm !== undefined && (data.labelHeightMm < 20 || data.labelHeightMm > 80)) {
    return { success: false, error: 'Label height must be between 20 and 80 mm' };
  }

  try {
    const result = await db
      .update(naixerQrFormatConfig)
      .set({
        ...(data.format !== undefined && { format: data.format }),
        ...(data.includeOrderId !== undefined && { includeOrderId: data.includeOrderId }),
        ...(data.parameterOrderJson !== undefined && {
          parameterOrderJson: data.parameterOrderJson,
        }),
        ...(data.labelWidthMm !== undefined && { labelWidthMm: Math.trunc(data.labelWidthMm) }),
        ...(data.labelHeightMm !== undefined && {
          labelHeightMm: Math.trunc(data.labelHeightMm),
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(naixerQrFormatConfig.id, id))
      .returning({ id: naixerQrFormatConfig.id });

    if (result.length === 0) return { success: false, error: 'Not found' };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ─── QR Preview ─────────────────────────────────────────────────────────────

export async function previewQrPayload(
  productCode: string,
  specCodes: string[],
  format: string,
  includeOrderId: boolean,
): Promise<{ payload: string; qrDataUrl: string }> {
  const strategy = format === 'pipe' ? pipeStrategy : dashStrategy;
  const payload = strategy.encode({
    orderNumber: includeOrderId ? 'ORD-PREVIEW' : undefined,
    productCode,
    specCodes,
  });
  const qrDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 192,
  });
  return { payload, qrDataUrl };
}
