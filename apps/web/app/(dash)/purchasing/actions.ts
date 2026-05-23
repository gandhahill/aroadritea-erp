'use server';

import { getSession } from '@/lib/auth';
import {
  and,
  asc,
  db,
  desc,
  eq,
  locations,
  partners,
  products,
  purchaseOrderLines,
  purchaseOrders,
  goodsReceiptNotes,
  grnLines,
  taxRates,
  sql
} from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { createPO, trackPurchaseOrderShipment, createGRN, confirmGRN } from '@erp/services/purchasing';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

export interface PurchasingDashboardData {
  purchaseOrders: Array<{
    id: string;
    number: string;
    status: string;
    supplierName: string;
    locationName: string;
    orderDate: string;
    grandTotal: string;
    lineCount: number;
    shippingCourierCode: string | null;
    shippingAwb: string | null;
    shippingTrackingStatus: string | null;
    shippingTrackingSyncedAt: string | null;
    shippingTrackingError: string | null;
  }>;
  suppliers: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    isPkp: boolean;
    isActive: boolean;
  }>;
  canCreate: boolean;
}

export interface PurchaseOrderFormData {
  suppliers: Array<{ id: string; name: string; isPkp: boolean }>;
  locations: Array<{ id: string; name: string }>;
  products: Array<{ id: string; sku: string; name: string; uom: string; defaultCostPrice: string }>;
  taxRates: Array<{ code: string; name: string; calculation: string }>;
}

interface ActionState {
  success: boolean;
  error?: string;
}

async function getSessionContext() {
  const session = await getSession();
  if (!session?.user) return null;

  const user = session.user as Record<string, unknown>;
  return {
    tenantId: (user.tenantId as string | undefined) ?? 'default',
    userId: user.id as string,
    locationId: (user.locationId as string | undefined) ?? 'global',
  };
}

function localizedName(value: unknown): string {
  if (value && typeof value === 'object') {
    const name = value as Record<string, string>;
    return name.id ?? name.en ?? name.zh ?? 'Tanpa nama';
  }
  return 'Tanpa nama';
}

export async function fetchPurchasingDashboard(): Promise<PurchasingDashboardData> {
  const ctx = await getSessionContext();
  if (!ctx) return { purchaseOrders: [], suppliers: [], canCreate: false };

  const [poRows, supplierRows] = await Promise.all([
    db
      .select({
        id: purchaseOrders.id,
        number: purchaseOrders.number,
        status: purchaseOrders.status,
        supplierName: partners.name,
        locationName: locations.name,
        orderDate: purchaseOrders.orderDate,
        grandTotal: purchaseOrders.grandTotal,
        shippingCourierCode: purchaseOrders.shippingCourierCode,
        shippingAwb: purchaseOrders.shippingAwb,
        shippingTrackingStatus: purchaseOrders.shippingTrackingStatus,
        shippingTrackingSyncedAt: purchaseOrders.shippingTrackingSyncedAt,
        shippingTrackingError: purchaseOrders.shippingTrackingError,
        lineId: purchaseOrderLines.id,
      })
      .from(purchaseOrders)
      .leftJoin(
        partners,
        and(eq(purchaseOrders.supplierId, partners.id), eq(partners.tenantId, ctx.tenantId)),
      )
      .leftJoin(
        locations,
        and(eq(purchaseOrders.locationId, locations.id), eq(locations.tenantId, ctx.tenantId)),
      )
      .leftJoin(purchaseOrderLines, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
      .where(eq(purchaseOrders.tenantId, ctx.tenantId))
      .orderBy(desc(purchaseOrders.orderDate), desc(purchaseOrders.createdAt)),
    db
      .select({
        id: partners.id,
        name: partners.name,
        phone: partners.phone,
        email: partners.email,
        isPkp: partners.isPkp,
        isActive: partners.isActive,
      })
      .from(partners)
      .where(and(eq(partners.tenantId, ctx.tenantId), eq(partners.kind, 'supplier')))
      .orderBy(asc(partners.name)),
  ]);

  const grouped = new Map<string, PurchasingDashboardData['purchaseOrders'][number]>();
  for (const row of poRows) {
    const existing = grouped.get(row.id);
    if (existing) {
      if (row.lineId) existing.lineCount += 1;
      continue;
    }
    grouped.set(row.id, {
      id: row.id,
      number: row.number,
      status: row.status,
      supplierName: row.supplierName ?? 'Supplier tidak ditemukan',
      locationName: localizedName(row.locationName),
      orderDate: row.orderDate,
      grandTotal: String(row.grandTotal),
      lineCount: row.lineId ? 1 : 0,
      shippingCourierCode: row.shippingCourierCode,
      shippingAwb: row.shippingAwb,
      shippingTrackingStatus: row.shippingTrackingStatus,
      shippingTrackingSyncedAt: row.shippingTrackingSyncedAt
        ? row.shippingTrackingSyncedAt.toISOString()
        : null,
      shippingTrackingError: row.shippingTrackingError,
    });
  }

  return {
    purchaseOrders: [...grouped.values()],
    suppliers: supplierRows,
    canCreate: true,
  };
}

export async function fetchPurchaseOrderFormData(): Promise<PurchaseOrderFormData> {
  const ctx = await getSessionContext();
  if (!ctx) return { suppliers: [], locations: [], products: [], taxRates: [] };

  const [supplierRows, locationRows, productRows, taxRows] = await Promise.all([
    db
      .select({ id: partners.id, name: partners.name, isPkp: partners.isPkp })
      .from(partners)
      .where(
        and(
          eq(partners.tenantId, ctx.tenantId),
          eq(partners.kind, 'supplier'),
          eq(partners.isActive, true),
        ),
      )
      .orderBy(asc(partners.name)),
    db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(
        and(
          eq(locations.tenantId, ctx.tenantId),
          eq(locations.status, 'active'),
          eq(locations.type, 'store'),
        ),
      )
      .orderBy(asc(locations.code)),
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        uom: products.uom,
        defaultCostPrice: products.defaultCostPrice,
      })
      .from(products)
      .where(
        and(
          eq(products.tenantId, ctx.tenantId),
          eq(products.isActive, true),
          eq(products.isPurchasable, true),
        ),
      )
      .orderBy(asc(products.sku)),
    db
      .select({ code: taxRates.code, name: taxRates.name, calculation: taxRates.calculation })
      .from(taxRates)
      .where(eq(taxRates.isActive, true))
      .orderBy(asc(taxRates.code)),
  ]);

  return {
    suppliers: supplierRows,
    locations: locationRows.map((row) => ({ id: row.id, name: localizedName(row.name) })),
    products: productRows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: localizedName(row.name),
      uom: row.uom,
      defaultCostPrice: String(row.defaultCostPrice),
    })),
    taxRates: taxRows.map((row) => ({
      code: row.code,
      name: localizedName(row.name),
      calculation: row.calculation,
    })),
  };
}

export async function createSupplierAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getSessionContext();
  if (!ctx) return { success: false, error: 'Sesi login tidak valid.' };

  const name = String(formData.get('supplierName') ?? '').trim();
  if (!name) return { success: false, error: 'Nama supplier wajib diisi.' };

  const id = generateId();
  await db.insert(partners).values({
    id,
    tenantId: ctx.tenantId,
    kind: 'supplier',
    name,
    phone: String(formData.get('supplierPhone') ?? '').trim() || null,
    email: String(formData.get('supplierEmail') ?? '').trim() || null,
    address: String(formData.get('supplierAddress') ?? '').trim() || null,
    isPkp: formData.get('supplierIsPkp') === 'on',
    paymentTermsDays: Number.parseInt(String(formData.get('paymentTermsDays') ?? '0'), 10) || 0,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'create',
    entityType: 'partner',
    entityId: id,
    after: {
      kind: 'supplier',
      name,
      phone: String(formData.get('supplierPhone') ?? '').trim() || null,
      email: String(formData.get('supplierEmail') ?? '').trim() || null,
      isPkp: formData.get('supplierIsPkp') === 'on',
    },
  });

  revalidatePath('/purchasing');
  revalidatePath('/purchasing/po/new');
  return { success: true };
}

export async function createPurchaseOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getSessionContext();
  if (!ctx) return { success: false, error: 'Sesi login tidak valid.' };

  const lineCount = Number.parseInt(String(formData.get('lineCount') ?? '0'), 10);
  const lines = Array.from({ length: lineCount }, (_, index) => ({
    productId: String(formData.get(`productId-${index}`) ?? ''),
    qtyOrdered: String(formData.get(`qtyOrdered-${index}`) ?? ''),
    uom: String(formData.get(`uom-${index}`) ?? ''),
    unitPrice: String(formData.get(`unitPrice-${index}`) ?? ''),
    taxCode: String(formData.get(`taxCode-${index}`) ?? '') || undefined,
  })).filter((line) => line.productId && line.qtyOrdered && line.uom && line.unitPrice);

  if (lines.length === 0) {
    return { success: false, error: 'Minimal satu baris pembelian wajib diisi.' };
  }

  const result = await createPO(
    {
      supplierId: String(formData.get('supplierId') ?? ''),
      locationId: String(formData.get('locationId') ?? ''),
      orderDate: String(formData.get('orderDate') ?? ''),
      expectedDate: String(formData.get('expectedDate') ?? '') || undefined,
      notes: String(formData.get('notes') ?? '').trim() || undefined,
      lines,
    },
    {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      locationId: String(formData.get('locationId') ?? ctx.locationId),
    },
  );

  if (!result.ok) return { success: false, error: result.error.message };

  revalidatePath('/purchasing');
  return { success: true };
}

export async function syncPurchaseShipmentAction(formData: FormData): Promise<ActionState> {
  const ctx = await getSessionContext();
  if (!ctx) return { success: false, error: 'Sesi login tidak valid.' };

  const result = await trackPurchaseOrderShipment(
    {
      poId: String(formData.get('poId') ?? ''),
      courierCode: String(formData.get('courierCode') ?? '') as never,
      awb: String(formData.get('awb') ?? ''),
      phoneLast5: String(formData.get('phoneLast5') ?? ''),
    },
    ctx,
  );

  revalidatePath('/purchasing');
  if (!result.ok) return { success: false, error: result.error.messageKey };
  return { success: true };
}

export async function receiveGoodsAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getSessionContext();
  if (!ctx) return { success: false, error: 'Sesi login tidak valid.' };

  const poId = String(formData.get('poId') ?? '');
  const locationId = String(formData.get('locationId') ?? ctx.locationId);
  const notes = String(formData.get('notes') ?? '');
  const receivedDate = new Date().toISOString(); // or from formData if needed, but today is fine for GRN

  // Parse lines from formData
  const lines: any[] = [];
  const entries = Array.from(formData.entries());
  
  // Format is usually lineId_XXX for qty, etc. or we can just pass a JSON string.
  // It's easier if the form submits a JSON string of lines or we parse them out.
  const linesJson = String(formData.get('linesData') ?? '[]');
  try {
    const parsedLines = JSON.parse(linesJson);
    for (const line of parsedLines) {
      if (Number(line.qtyReceived) > 0) {
        lines.push({
          poLineId: line.poLineId,
          productId: line.productId,
          variantId: line.variantId || undefined,
          qtyReceived: String(line.qtyReceived),
          uom: line.uom,
          batchNo: line.batchNo || undefined,
          expiryDate: line.expiryDate || undefined,
        });
      }
    }
  } catch (e) {
    return { success: false, error: 'Invalid lines data' };
  }

  if (lines.length === 0) {
    return { success: false, error: 'No items to receive.' };
  }

  const grnResult = await createGRN(
    {
      purchaseOrderId: poId,
      locationId: locationId,
      receivedDate,
      notes: notes || undefined,
      lines,
    },
    {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      locationId: ctx.locationId,
    }
  );

  if (!grnResult.ok) {
    return { success: false, error: grnResult.error.messageKey || grnResult.error.message };
  }

  const confirmResult = await confirmGRN(
    {
      grnId: grnResult.value.id,
    },
    {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      locationId: ctx.locationId,
    }
  );

  if (!confirmResult.ok) {
    return { success: false, error: confirmResult.error.messageKey || confirmResult.error.message };
  }

  revalidatePath('/purchasing');
  revalidatePath(`/purchasing/po/${poId}`);
  return { success: true };
}

export async function fetchGRNReport(
  page = 1,
  pageSize = 20,
  status = '',
  locationId = '',
  startDate = '',
  endDate = ''
) {
  const ctx = await getSessionContext();
  if (!ctx) return { data: [], total: 0, locations: [] };

  const conditions = [eq(goodsReceiptNotes.tenantId, ctx.tenantId)];
  if (status) {
    conditions.push(eq(goodsReceiptNotes.status, status));
  }
  if (locationId) {
    conditions.push(eq(goodsReceiptNotes.locationId, locationId));
  }
  if (startDate) {
    conditions.push(sql`${goodsReceiptNotes.receivedDate} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${goodsReceiptNotes.receivedDate} <= ${endDate}`);
  }

  const [countResult, locationRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(goodsReceiptNotes)
      .where(and(...conditions)),
    db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.status, 'active')))
  ]);

  const total = countResult[0]?.count ?? 0;

  const rows = await db
    .select({
      id: goodsReceiptNotes.id,
      number: goodsReceiptNotes.number,
      receivedDate: goodsReceiptNotes.receivedDate,
      status: goodsReceiptNotes.status,
      purchaseOrderId: purchaseOrders.id,
      poNumber: purchaseOrders.number,
      supplierName: partners.name,
      locationName: locations.name,
    })
    .from(goodsReceiptNotes)
    .leftJoin(purchaseOrders, eq(goodsReceiptNotes.purchaseOrderId, purchaseOrders.id))
    .leftJoin(partners, eq(purchaseOrders.supplierId, partners.id))
    .leftJoin(locations, eq(goodsReceiptNotes.locationId, locations.id))
    .where(and(...conditions))
    .orderBy(desc(goodsReceiptNotes.receivedDate), desc(goodsReceiptNotes.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    data: rows.map((r) => ({
      ...r,
      supplierName: r.supplierName || 'Unknown Supplier',
      locationName: localizedName(r.locationName),
    })),
    total,
    locations: locationRows.map(l => ({ id: l.id, name: localizedName(l.name) }))
  };
}
