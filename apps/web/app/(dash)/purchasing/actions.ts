'use server';

import { getSession } from '@/lib/auth';
import {
  authorizedLocationIdsForTenant,
  hasGlobalPermission,
  requirePermissionAtLocation,
} from '@/lib/authz';
import {
  and,
  asc,
  db,
  desc,
  eq,
  goodsReceiptNotes,
  grnLines,
  inArray,
  locations,
  partners,
  products,
  purchaseOrderLines,
  purchaseOrders,
  sql,
  taxRates,
} from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import {
  confirmGRN,
  createGRN,
  createPO,
  trackPurchaseOrderShipment,
  createPurchaseInvoice,
  verifyPurchaseInvoice,
  cancelPurchaseInvoice,
  createPurchaseRequisition,
  submitPurchaseRequisition,
  approvePurchaseRequisition,
  createRFQ,
} from '@erp/services/purchasing';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';

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
    address: string | null;
    paymentTermsDays: number | null;
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
  const viewScope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'purchasing.view',
    ctx.tenantId,
  );
  const createScope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'purchasing.po.create',
    ctx.tenantId,
  );
  if (viewScope.locationIds.length === 0) {
    return { purchaseOrders: [], suppliers: [], canCreate: createScope.locationIds.length > 0 };
  }

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
      .where(
        and(
          eq(purchaseOrders.tenantId, ctx.tenantId),
          inArray(purchaseOrders.locationId, viewScope.locationIds),
        ),
      )
      .orderBy(desc(purchaseOrders.orderDate), desc(purchaseOrders.createdAt)),
    db
      .select({
        id: partners.id,
        name: partners.name,
        phone: partners.phone,
        email: partners.email,
        address: partners.address,
        paymentTermsDays: partners.paymentTermsDays,
        isPkp: partners.isPkp,
        isActive: partners.isActive,
      })
      .from(partners)
      .where(and(eq(partners.tenantId, ctx.tenantId), eq(partners.kind, 'supplier'), eq(partners.isActive, true)))
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
    canCreate: createScope.locationIds.length > 0,
  };
}

export async function fetchPurchaseOrderFormData(): Promise<PurchaseOrderFormData> {
  const ctx = await getSessionContext();
  if (!ctx) return { suppliers: [], locations: [], products: [], taxRates: [] };
  const createScope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'purchasing.po.create',
    ctx.tenantId,
  );
  if (createScope.locationIds.length === 0) {
    return { suppliers: [], locations: [], products: [], taxRates: [] };
  }

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
          inArray(locations.id, createScope.locationIds),
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
  const t = await getTranslations('purchasing.errors');
  if (!ctx) return { success: false, error: t('invalidSession') };
  const allowed = await hasGlobalPermission(ctx.userId, 'purchasing.po.create');
  if (!allowed) return { success: false, error: t('unauthorized') };

  const name = String(formData.get('supplierName') ?? '').trim();
  if (!name) return { success: false, error: t('supplierNameRequired') };

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

export async function updateSupplierAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getSessionContext();
  const t = await getTranslations('purchasing.errors');
  if (!ctx) return { success: false, error: t('invalidSession') };
  const allowed = await hasGlobalPermission(ctx.userId, 'purchasing.po.create');
  if (!allowed) return { success: false, error: t('unauthorized') };

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { success: false, error: t('supplierIdRequired') };

  const name = String(formData.get('supplierName') ?? '').trim();
  if (!name) return { success: false, error: t('supplierNameRequired') };

  await db.update(partners)
    .set({
      name,
      phone: String(formData.get('supplierPhone') ?? '').trim() || null,
      email: String(formData.get('supplierEmail') ?? '').trim() || null,
      address: String(formData.get('supplierAddress') ?? '').trim() || null,
      isPkp: formData.get('supplierIsPkp') === 'on',
      paymentTermsDays: Number.parseInt(String(formData.get('paymentTermsDays') ?? '0'), 10) || 0,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(partners.id, id), eq(partners.tenantId, ctx.tenantId)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'update',
    entityType: 'partner',
    entityId: id,
    after: {
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

export async function deleteSupplierAction(id: string, formData?: FormData): Promise<ActionState> {
  const ctx = await getSessionContext();
  const t = await getTranslations('purchasing.errors');
  if (!ctx) return { success: false, error: t('invalidSession') };
  const allowed = await hasGlobalPermission(ctx.userId, 'purchasing.po.create');
  if (!allowed) return { success: false, error: t('unauthorized') };

  await db.update(partners)
    .set({
      isActive: false,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(partners.id, id), eq(partners.tenantId, ctx.tenantId)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'partner',
    entityId: id,
    after: {
      isActive: false,
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
  const t = await getTranslations('purchasing.errors');
  if (!ctx) return { success: false, error: t('invalidSession') };
  const locationId = String(formData.get('locationId') ?? ctx.locationId);
  const allowed = await requirePermissionAtLocation(ctx.userId, 'purchasing.po.create', locationId);
  if (!allowed) return { success: false, error: t('unauthorized') };

  const lineCount = Number.parseInt(String(formData.get('lineCount') ?? '0'), 10);
  const lines = Array.from({ length: lineCount }, (_, index) => ({
    productId: String(formData.get(`productId-${index}`) ?? ''),
    qtyOrdered: String(formData.get(`qtyOrdered-${index}`) ?? ''),
    uom: String(formData.get(`uom-${index}`) ?? ''),
    unitPrice: String(formData.get(`unitPrice-${index}`) ?? ''),
    taxCode: String(formData.get(`taxCode-${index}`) ?? '') || undefined,
  })).filter((line) => line.productId && line.qtyOrdered && line.uom && line.unitPrice);

  if (lines.length === 0) {
    return { success: false, error: t('minOneLineRequired') };
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
      locationId,
    },
  );

  if (!result.ok) return { success: false, error: result.error.message };

  revalidatePath('/purchasing');
  return { success: true };
}

export async function syncPurchaseShipmentAction(formData: FormData): Promise<ActionState> {
  const ctx = await getSessionContext();
  const t = await getTranslations('purchasing.errors');
  if (!ctx) return { success: false, error: t('invalidSession') };
  const poId = String(formData.get('poId') ?? '');
  const [poRow] = await db
    .select({ locationId: purchaseOrders.locationId })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, ctx.tenantId)))
    .limit(1);
  if (!poRow) return { success: false, error: t('unauthorized') };
  const allowed = await requirePermissionAtLocation(
    ctx.userId,
    'purchasing.view',
    poRow.locationId,
  );
  if (!allowed) return { success: false, error: t('unauthorized') };

  const result = await trackPurchaseOrderShipment(
    {
      poId,
      courierCode: String(formData.get('courierCode') ?? '') as never,
      awb: String(formData.get('awb') ?? ''),
      phoneLast5: String(formData.get('phoneLast5') ?? ''),
    },
    { ...ctx, locationId: poRow.locationId },
  );


  revalidatePath('/purchasing');
  revalidatePath('/purchasing/shipments');
  revalidatePath(`/purchasing/po/${poId}`);
  if (!result.ok) return { success: false, error: result.error.messageKey };
  return { success: true };
}

// ─── Shipments (T-0185) ─────────────────────────────────────────────────
//
// Centralised "what's in transit" view across all POs that have shipment
// info. Pull from cached PO columns — no API hit on page load.

export interface ShipmentSummaryRow {
  poId: string;
  poNumber: string;
  supplierName: string;
  locationName: string;
  orderDate: string;
  expectedDate: string | null;
  poStatus: string;
  courierCode: string | null;
  awb: string | null;
  trackingStatus: string | null;
  trackingSyncedAt: string | null;
  trackingError: string | null;
  hasHistory: boolean;
}

export interface ShipmentDetail {
  poId: string;
  poNumber: string;
  supplierName: string;
  locationName: string;
  courierCode: string | null;
  awb: string | null;
  phoneLast5: string | null;
  trackingStatus: string | null;
  trackingSyncedAt: string | null;
  trackingError: string | null;
  summary: Record<string, unknown> | null;
  history: Array<Record<string, unknown>>;
}

export async function fetchShipmentDashboard(): Promise<{
  rows: ShipmentSummaryRow[];
  total: number;
  withShipping: number;
  delivered: number;
  inTransit: number;
  errored: number;
}> {
  const ctx = await getSessionContext();
  if (!ctx) return { rows: [], total: 0, withShipping: 0, delivered: 0, inTransit: 0, errored: 0 };
  const viewScope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'purchasing.view',
    ctx.tenantId,
  );
  if (viewScope.locationIds.length === 0) {
    return { rows: [], total: 0, withShipping: 0, delivered: 0, inTransit: 0, errored: 0 };
  }

  const rows = await db
    .select({
      id: purchaseOrders.id,
      number: purchaseOrders.number,
      status: purchaseOrders.status,
      orderDate: purchaseOrders.orderDate,
      expectedDate: purchaseOrders.expectedDate,
      supplierName: partners.name,
      locationName: locations.name,
      courierCode: purchaseOrders.shippingCourierCode,
      awb: purchaseOrders.shippingAwb,
      trackingStatus: purchaseOrders.shippingTrackingStatus,
      trackingSyncedAt: purchaseOrders.shippingTrackingSyncedAt,
      trackingError: purchaseOrders.shippingTrackingError,
      history: purchaseOrders.shippingTrackingHistory,
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
    .where(
      and(
        eq(purchaseOrders.tenantId, ctx.tenantId),
        inArray(purchaseOrders.locationId, viewScope.locationIds),
      ),
    )
    .orderBy(desc(purchaseOrders.orderDate));

  const mapped: ShipmentSummaryRow[] = rows.map((row) => ({
    poId: row.id,
    poNumber: row.number,
    supplierName: row.supplierName ?? '—',
    locationName: localizedName(row.locationName),
    orderDate: row.orderDate,
    expectedDate: row.expectedDate ?? null,
    poStatus: row.status,
    courierCode: row.courierCode,
    awb: row.awb,
    trackingStatus: row.trackingStatus,
    trackingSyncedAt: row.trackingSyncedAt ? row.trackingSyncedAt.toISOString() : null,
    trackingError: row.trackingError,
    hasHistory: Array.isArray(row.history) && (row.history as unknown[]).length > 0,
  }));

  const withShipping = mapped.filter((r) => r.awb || r.trackingStatus).length;
  const delivered = mapped.filter(
    (r) =>
      r.trackingStatus &&
      ['DELIVERED', 'TERKIRIM', 'DITERIMA'].includes(r.trackingStatus.toUpperCase()),
  ).length;
  const errored = mapped.filter((r) => r.trackingError).length;
  const inTransit = withShipping - delivered - errored;

  return {
    rows: mapped,
    total: mapped.length,
    withShipping,
    delivered,
    inTransit: Math.max(0, inTransit),
    errored,
  };
}

export async function fetchShipmentDetail(poId: string): Promise<ShipmentDetail | null> {
  const ctx = await getSessionContext();
  if (!ctx) return null;

  const [row] = await db
    .select({
      id: purchaseOrders.id,
      number: purchaseOrders.number,
      locationId: purchaseOrders.locationId,
      supplierName: partners.name,
      locationName: locations.name,
      courierCode: purchaseOrders.shippingCourierCode,
      awb: purchaseOrders.shippingAwb,
      phoneLast5: purchaseOrders.shippingPhoneLast5,
      trackingStatus: purchaseOrders.shippingTrackingStatus,
      trackingSyncedAt: purchaseOrders.shippingTrackingSyncedAt,
      trackingError: purchaseOrders.shippingTrackingError,
      summary: purchaseOrders.shippingTrackingSummary,
      history: purchaseOrders.shippingTrackingHistory,
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
    .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, ctx.tenantId)))
    .limit(1);

  if (!row) return null;
  const allowed = await requirePermissionAtLocation(ctx.userId, 'purchasing.view', row.locationId);
  if (!allowed) return null;

  return {
    poId: row.id,
    poNumber: row.number,
    supplierName: row.supplierName ?? '—',
    locationName: localizedName(row.locationName),
    courierCode: row.courierCode,
    awb: row.awb,
    phoneLast5: row.phoneLast5,
    trackingStatus: row.trackingStatus,
    trackingSyncedAt: row.trackingSyncedAt ? row.trackingSyncedAt.toISOString() : null,
    trackingError: row.trackingError,
    summary: row.summary as Record<string, unknown> | null,
    history: Array.isArray(row.history) ? (row.history as Array<Record<string, unknown>>) : [],
  };
}

export async function receiveGoodsAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getSessionContext();
  const t = await getTranslations('purchasing.errors');
  if (!ctx) return { success: false, error: t('invalidSession') };

  const poId = String(formData.get('poId') ?? '');
  const locationId = String(formData.get('locationId') ?? ctx.locationId);
  const allowed = await requirePermissionAtLocation(
    ctx.userId,
    'purchasing.grn.create',
    locationId,
  );
  if (!allowed) return { success: false, error: t('unauthorized') };
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
    return { success: false, error: t('invalidLinesData') };
  }

  if (lines.length === 0) {
    return { success: false, error: t('noItemsToReceive') };
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
      locationId,
    },
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
      locationId,
    },
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
  endDate = '',
) {
  const ctx = await getSessionContext();
  if (!ctx) return { data: [], total: 0, locations: [] };
  const viewScope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'purchasing.view',
    ctx.tenantId,
  );
  if (viewScope.locationIds.length === 0) return { data: [], total: 0, locations: [] };

  const conditions = [eq(goodsReceiptNotes.tenantId, ctx.tenantId)];
  if (status) {
    conditions.push(eq(goodsReceiptNotes.status, status));
  }
  if (locationId) {
    if (!viewScope.locationIds.includes(locationId)) return { data: [], total: 0, locations: [] };
    conditions.push(eq(goodsReceiptNotes.locationId, locationId));
  } else {
    conditions.push(inArray(goodsReceiptNotes.locationId, viewScope.locationIds));
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
      .where(
        and(
          eq(locations.tenantId, ctx.tenantId),
          eq(locations.status, 'active'),
          inArray(locations.id, viewScope.locationIds),
        ),
      ),
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
    locations: locationRows.map((l) => ({ id: l.id, name: localizedName(l.name) })),
  };
}

export async function createPurchaseInvoiceAction(input: unknown) {
  const ctx = await getSessionContext();
  const t = await getTranslations('purchasing.errors');
  if (!ctx) return { success: false, error: t('unauthorized') };
  const res = await createPurchaseInvoice(input, ctx as any);
  if (res.ok) {
    revalidatePath('/purchasing');
  }
  return res;
}

export async function verifyPurchaseInvoiceAction(input: unknown) {
  const ctx = await getSessionContext();
  const t = await getTranslations('purchasing.errors');
  if (!ctx) return { success: false, error: t('unauthorized') };
  const res = await verifyPurchaseInvoice(input, ctx as any);
  if (res.ok) {
    revalidatePath('/purchasing');
  }
  return res;
}

export async function cancelPurchaseInvoiceAction(input: unknown) {
  const ctx = await getSessionContext();
  const t = await getTranslations('purchasing.errors');
  if (!ctx) return { success: false, error: t('unauthorized') };
  const res = await cancelPurchaseInvoice(input, ctx as any);
  if (res.ok) {
    revalidatePath('/purchasing');
  }
  return res;
}

export async function createPurchaseRequisitionAction(input: unknown) {
  const ctx = await getSessionContext();
  const t = await getTranslations('purchasing.errors');
  if (!ctx) return { success: false, error: t('unauthorized') };
  const res = await createPurchaseRequisition(input, ctx as any);
  if (res.ok) {
    revalidatePath('/purchasing');
  }
  return res;
}

export async function submitPurchaseRequisitionAction(input: unknown) {
  const ctx = await getSessionContext();
  const t = await getTranslations('purchasing.errors');
  if (!ctx) return { success: false, error: t('unauthorized') };
  const res = await submitPurchaseRequisition(input, ctx as any);
  if (res.ok) {
    revalidatePath('/purchasing');
  }
  return res;
}

export async function approvePurchaseRequisitionAction(input: unknown) {
  const ctx = await getSessionContext();
  const t = await getTranslations('purchasing.errors');
  if (!ctx) return { success: false, error: t('unauthorized') };
  const res = await approvePurchaseRequisition(input, ctx as any);
  if (res.ok) {
    revalidatePath('/purchasing');
  }
  return res;
}

export async function createRFQAction(input: unknown) {
  const ctx = await getSessionContext();
  const t = await getTranslations('purchasing.errors');
  if (!ctx) return { success: false, error: t('unauthorized') };
  const res = await createRFQ(input, ctx as any);
  if (res.ok) {
    revalidatePath('/purchasing');
  }
  return res;
}
