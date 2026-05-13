/**
 * kitchen/generate-qr.ts — Generate KDS QR payload for a sales order line (SD §33.3)
 *
 * Steps:
 * 1. Fetch naixer_qr_format_config for the location
 * 2. Lookup naixer_product_codes for (product_id, variant_id)
 * 3. Lookup naixer_modifier_codes for each modifier, ordered by parameter_order
 * 4. Encode via strategy (dash/pipe)
 * 5. Optionally prefix with DEMO-
 */

import { db } from '@erp/db';
import {
  naixerModifierCodes,
  naixerProductCodes,
  naixerQrFormatConfig,
} from '@erp/db/schema/kitchen';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { requirePermission } from '../iam';
import { type NaixerQRPayload, getStrategy, wrapDemo } from './qr-strategy';

// ─── Input types ────────────────────────────────────────────────────────────

export interface GenerateQRInput {
  locationId: string;
  productId: string;
  variantId?: string | null;
  orderNumber?: string;
  modifiers: Array<{
    kind: string; // 'size' | 'ice' | 'sugar' | 'topping' | 'cup' | 'other'
    optionId: string; // product_modifier_options.id
  }>;
  isDemo?: boolean;
}

export interface QRPayloadResult {
  payload: string;
  productCode: string;
  specCodes: string[];
  format: string;
  missingCodes: string[];
}

// ─── Service ────────────────────────────────────────────────────────────────

export async function generateQrPayload(
  input: GenerateQRInput,
  ctx: AuditContext,
): Promise<Result<QRPayloadResult>> {
  const permCheck = await requirePermission(ctx.userId, 'kitchen.view', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // 1. Fetch QR format config for location
  const [config] = await db
    .select()
    .from(naixerQrFormatConfig)
    .where(
      and(
        eq(naixerQrFormatConfig.locationId, input.locationId),
        eq(naixerQrFormatConfig.isActive, true),
      ),
    )
    .limit(1);

  if (!config) {
    return err(
      AppError.notFound('kitchen.errors.qr_config_not_found', {
        locationId: input.locationId,
      }),
    );
  }

  // 2. Lookup product code
  const productConditions = [
    eq(naixerProductCodes.tenantId, ctx.tenantId),
    eq(naixerProductCodes.productId, input.productId),
    eq(naixerProductCodes.isActive, true),
  ];

  // Try specific variant first, then fallback to null variant
  let productCodeRow = null;
  if (input.variantId) {
    [productCodeRow] = await db
      .select()
      .from(naixerProductCodes)
      .where(and(...productConditions, eq(naixerProductCodes.variantId, input.variantId)))
      .limit(1);
  }

  if (!productCodeRow) {
    // Fallback: look for entry with null variant (applies to all variants)
    const rows = await db
      .select()
      .from(naixerProductCodes)
      .where(and(...productConditions))
      .limit(2);

    productCodeRow = rows.find((r) => r.variantId === null) ?? rows[0] ?? null;
  }

  if (!productCodeRow) {
    return err(
      AppError.notFound('kitchen.errors.product_code_not_found', {
        productId: input.productId,
        variantId: input.variantId,
      }),
    );
  }

  // 3. Lookup modifier codes
  const parameterOrder = config.parameterOrderJson as string[];
  const specCodes: string[] = [];
  const missingCodes: string[] = [];

  for (const kind of parameterOrder) {
    if (kind === 'product') continue; // product code already resolved

    const modifier = input.modifiers.find((m) => m.kind === kind);
    if (!modifier) continue;

    const [modCode] = await db
      .select()
      .from(naixerModifierCodes)
      .where(
        and(
          eq(naixerModifierCodes.tenantId, ctx.tenantId),
          eq(naixerModifierCodes.modifierOptionId, modifier.optionId),
          eq(naixerModifierCodes.isActive, true),
        ),
      )
      .limit(1);

    if (modCode) {
      specCodes.push(modCode.naixerCode);
    } else {
      missingCodes.push(`${kind}:${modifier.optionId}`);
    }
  }

  // 4. Encode via strategy
  const strategy = getStrategy(config.format);
  const qrPayload: NaixerQRPayload = {
    orderNumber: config.includeOrderId ? input.orderNumber : undefined,
    productCode: productCodeRow.naixerCode,
    specCodes,
  };

  const raw = strategy.encode(qrPayload);
  const payload = wrapDemo(raw, input.isDemo ?? false);

  return ok({
    payload,
    productCode: productCodeRow.naixerCode,
    specCodes,
    format: config.format,
    missingCodes,
  });
}
