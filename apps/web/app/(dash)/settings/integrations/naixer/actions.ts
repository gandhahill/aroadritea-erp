/**
 * Naixer KDS Settings — Server Actions (SD §33.7, ADR-0007)
 * CRUD for product codes, modifier codes, and QR format config.
 */

'use server';

import { and, db, desc, eq } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import {
  naixerModifierCodes,
  naixerProductCodes,
  naixerQrFormatConfig,
} from '@erp/db/schema/kitchen';
import { dashStrategy, pipeStrategy } from '@erp/services/kitchen';
import { generateId } from '@erp/shared/id';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProductCodeItem {
  id: string;
  productId: string;
  variantId: string | null;
  naixerCode: string;
  isActive: boolean;
}

export interface ModifierCodeItem {
  id: string;
  modifierKind: string;
  modifierOptionId: string;
  naixerCode: string;
  displayOrder: number;
  isActive: boolean;
}

export interface FormatConfigItem {
  id: string;
  locationId: string;
  locationName: string;
  format: string;
  includeOrderId: boolean;
  parameterOrderJson: string[];
  isActive: boolean;
}

type ActionResult = { success: boolean; error?: string };

// ─── Product Codes ──────────────────────────────────────────────────────────

export async function fetchProductCodes(tenantId: string): Promise<ProductCodeItem[]> {
  return db
    .select({
      id: naixerProductCodes.id,
      productId: naixerProductCodes.productId,
      variantId: naixerProductCodes.variantId,
      naixerCode: naixerProductCodes.naixerCode,
      isActive: naixerProductCodes.isActive,
    })
    .from(naixerProductCodes)
    .where(eq(naixerProductCodes.tenantId, tenantId))
    .orderBy(naixerProductCodes.naixerCode);
}

export async function createProductCode(
  tenantId: string,
  data: { productId: string; variantId?: string; naixerCode: string },
): Promise<ActionResult> {
  try {
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
  return db
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
    .orderBy(naixerModifierCodes.modifierKind, naixerModifierCodes.displayOrder);
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
  const configs = await db
    .select({
      id: naixerQrFormatConfig.id,
      locationId: naixerQrFormatConfig.locationId,
      format: naixerQrFormatConfig.format,
      includeOrderId: naixerQrFormatConfig.includeOrderId,
      parameterOrderJson: naixerQrFormatConfig.parameterOrderJson,
      isActive: naixerQrFormatConfig.isActive,
    })
    .from(naixerQrFormatConfig);

  const locs = await db
    .select({ id: locations.id, name: locations.name, code: locations.code })
    .from(locations)
    .where(eq(locations.tenantId, tenantId));

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
    isActive?: boolean;
  },
): Promise<ActionResult> {
  try {
    const result = await db
      .update(naixerQrFormatConfig)
      .set({
        ...(data.format !== undefined && { format: data.format }),
        ...(data.includeOrderId !== undefined && { includeOrderId: data.includeOrderId }),
        ...(data.parameterOrderJson !== undefined && {
          parameterOrderJson: data.parameterOrderJson,
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
): Promise<{ payload: string }> {
  const strategy = format === 'pipe' ? pipeStrategy : dashStrategy;
  const payload = strategy.encode({
    orderNumber: includeOrderId ? 'ORD-PREVIEW' : undefined,
    productCode,
    specCodes,
  });
  return { payload };
}
