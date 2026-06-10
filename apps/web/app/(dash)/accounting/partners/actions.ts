'use server';

import { randomUUID } from 'node:crypto';
import { getSession } from '@/lib/auth';
import { and, asc, db, eq, isNull } from '@erp/db';
import { partners } from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { requirePermission } from '@erp/services/iam';
import { revalidatePath } from 'next/cache';

async function getContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
  };
}

export interface PartnerRow {
  id: string;
  kind: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  npwp: string | null;
  isPkp: boolean;
  paymentTermsDays: number | null;
  rating: number | null;
  leadTimeDays: number | null;
  isActive: boolean;
}

export async function fetchPartnersAction(kindFilter?: string): Promise<PartnerRow[]> {
  const ctx = await getContext();
  if (!ctx) return [];

  const perm = await requirePermission(ctx.userId, 'accounting.view');
  if (!perm.ok) return [];

  const conditions = [eq(partners.tenantId, ctx.tenantId), isNull(partners.deletedAt)];
  if (kindFilter && kindFilter !== 'all') {
    conditions.push(eq(partners.kind, kindFilter));
  }

  const rows = await db
    .select({
      id: partners.id,
      kind: partners.kind,
      name: partners.name,
      email: partners.email,
      phone: partners.phone,
      address: partners.address,
      npwp: partners.npwp,
      isPkp: partners.isPkp,
      paymentTermsDays: partners.paymentTermsDays,
      rating: partners.rating,
      leadTimeDays: partners.leadTimeDays,
      isActive: partners.isActive,
    })
    .from(partners)
    .where(and(...conditions))
    .orderBy(asc(partners.name));

  return rows;
}

interface ActionState {
  success: boolean;
  error?: string;
}

export async function savePartnerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const perm = await requirePermission(ctx.userId, 'accounting.view');
  if (!perm.ok) return { success: false, error: 'Forbidden' };

  const id = (formData.get('id') as string) || '';
  const kind = (formData.get('kind') as string) || 'customer';
  const name = (formData.get('name') as string) || '';
  const email = (formData.get('email') as string) || null;
  const phone = (formData.get('phone') as string) || null;
  const address = (formData.get('address') as string) || null;
  const npwp = (formData.get('npwp') as string) || null;
  const isPkp = formData.get('isPkp') === 'on';
  const paymentTermsDays =
    Number.parseInt(String(formData.get('paymentTermsDays') ?? '0'), 10) || 0;
  const leadTimeDays = Number.parseInt(String(formData.get('leadTimeDays') ?? '0'), 10) || 0;

  if (!name.trim()) return { success: false, error: 'Name is required' };

  if (id) {
    // Update
    await db
      .update(partners)
      .set({
        kind,
        name: name.trim(),
        email,
        phone,
        address,
        npwp,
        isPkp,
        paymentTermsDays,
        leadTimeDays,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(and(eq(partners.id, id), eq(partners.tenantId, ctx.tenantId)));

    await db.insert(auditLog).values({
      id: randomUUID(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'partner',
      entityId: id,
      after: { kind, name: name.trim(), email, phone, isPkp, paymentTermsDays },
    });
  } else {
    // Create
    const newId = randomUUID();
    await db.insert(partners).values({
      id: newId,
      tenantId: ctx.tenantId,
      kind,
      name: name.trim(),
      email,
      phone,
      address,
      npwp,
      isPkp,
      paymentTermsDays,
      leadTimeDays,
      isActive: true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    await db.insert(auditLog).values({
      id: randomUUID(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'partner',
      entityId: newId,
      after: { kind, name: name.trim(), email, phone, isPkp, paymentTermsDays },
    });
  }

  revalidatePath('/accounting/partners');
  revalidatePath('/accounting/invoices/new');
  revalidatePath('/accounting/journals/new');
  revalidatePath('/purchasing/po/new');
  return { success: true };
}

export async function togglePartnerAction(id: string): Promise<ActionState> {
  const ctx = await getContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const perm = await requirePermission(ctx.userId, 'accounting.view');
  if (!perm.ok) return { success: false, error: 'Forbidden' };

  const [row] = await db
    .select({ isActive: partners.isActive })
    .from(partners)
    .where(and(eq(partners.id, id), eq(partners.tenantId, ctx.tenantId)));
  if (!row) return { success: false, error: 'Not found' };

  const newStatus = !row.isActive;
  await db
    .update(partners)
    .set({ isActive: newStatus, updatedAt: new Date(), updatedBy: ctx.userId })
    .where(and(eq(partners.id, id), eq(partners.tenantId, ctx.tenantId)));

  await db.insert(auditLog).values({
    id: randomUUID(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'update',
    entityType: 'partner',
    entityId: id,
    after: { isActive: newStatus },
  });

  revalidatePath('/accounting/partners');
  return { success: true };
}
