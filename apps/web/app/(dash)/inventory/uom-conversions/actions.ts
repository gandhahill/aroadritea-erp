'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq } from '@erp/db';
import { products } from '@erp/db/schema/inventory';
import {
  type UomConversionResult,
  deleteUomConversion,
  listUomConversions,
  upsertUomConversion,
} from '@erp/services/inventory';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

async function getAuditContext(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export interface UomConversionsPageData {
  conversions: UomConversionResult[];
  products: Array<{ id: string; sku: string; name: unknown; uom: string }>;
  error?: string;
}

export async function fetchUomConversionsPageData(): Promise<UomConversionsPageData> {
  const ctx = await getAuditContext();
  if (!ctx) return { conversions: [], products: [], error: 'Unauthenticated' };

  const [conversions, productRows] = await Promise.all([
    listUomConversions(ctx),
    db
      .select({ id: products.id, sku: products.sku, name: products.name, uom: products.uom })
      .from(products)
      .where(and(eq(products.tenantId, ctx.tenantId), eq(products.isActive, true)))
      .orderBy(products.sku),
  ]);

  if (!conversions.ok) {
    return { conversions: [], products: [], error: errorMessage(conversions.error) };
  }
  return { conversions: conversions.value, products: productRows };
}

export async function upsertUomConversionAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAuditContext();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };

  const conversionId = String(formData.get('conversionId') ?? '').trim() || undefined;
  const productId = String(formData.get('productId') ?? '').trim() || null;

  const result = await upsertUomConversion(
    {
      conversionId,
      productId,
      fromUom: String(formData.get('fromUom') ?? '').trim(),
      toUom: String(formData.get('toUom') ?? '').trim(),
      multiplyBy: String(formData.get('multiplyBy') ?? '').trim(),
    },
    ctx,
  );
  if (!result.ok) return { ok: false, error: errorMessage(result.error) };

  revalidatePath('/inventory/uom-conversions');
  return { ok: true };
}

export async function deleteUomConversionAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAuditContext();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };

  const result = await deleteUomConversion(id, ctx);
  if (!result.ok) return { ok: false, error: errorMessage(result.error) };

  revalidatePath('/inventory/uom-conversions');
  return { ok: true };
}
