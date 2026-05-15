'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq, isNull } from '@erp/db';
import { auditLog, locations } from '@erp/db';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

export type LocationType = 'store' | 'office' | 'warehouse';
export type LocationStatus = 'active' | 'inactive';

export interface LocationItem {
  id: string;
  code: string;
  name: { id: string; en: string; zh: string };
  type: LocationType;
  timezone: string;
  currency: string;
  address: string;
  status: LocationStatus;
}

export interface LocationDraft {
  id?: string | null;
  code: string;
  name: { id: string; en: string; zh: string };
  type: LocationType;
  timezone: string;
  currency: string;
  address: string;
  status: LocationStatus;
}

export type LocationActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

function normalizeName(value: unknown, fallback: string): LocationItem['name'] {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const id = String(record.id ?? fallback).trim() || fallback;
  return {
    id,
    en: String(record.en ?? id).trim() || id,
    zh: String(record.zh ?? id).trim() || id,
  };
}

function isLocationType(value: string): value is LocationType {
  return value === 'store' || value === 'office' || value === 'warehouse';
}

function isLocationStatus(value: string): value is LocationStatus {
  return value === 'active' || value === 'inactive';
}

async function requireContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');
  const settingsPerm = await requirePermission(userId, 'settings.manage');
  if (settingsPerm.ok) return { tenantId, userId };
  const locationPerm = await requirePermission(userId, 'iam.manage_locations');
  if (locationPerm.ok) return { tenantId, userId };
  return null;
}

export async function fetchLocations(): Promise<LocationItem[]> {
  const ctx = await requireContext();
  if (!ctx) return [];

  const rows = await db
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
      type: locations.type,
      timezone: locations.timezone,
      currency: locations.currency,
      address: locations.address,
      status: locations.status,
    })
    .from(locations)
    .where(and(eq(locations.tenantId, ctx.tenantId), isNull(locations.deletedAt)))
    .orderBy(locations.type, locations.code);

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: normalizeName(row.name, row.code),
    type: isLocationType(row.type) ? row.type : 'store',
    timezone: row.timezone,
    currency: row.currency,
    address: row.address ?? '',
    status: isLocationStatus(row.status) ? row.status : 'active',
  }));
}

export async function saveLocation(input: LocationDraft): Promise<LocationActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { success: false, error: 'Forbidden' };

  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,16}$/.test(code)) {
    return { success: false, error: 'Kode lokasi harus 2-16 karakter A-Z, angka, _ atau -.' };
  }
  if (!input.name.id.trim()) return { success: false, error: 'Nama Indonesia wajib diisi.' };

  const values = {
    code,
    name: {
      id: input.name.id.trim(),
      en: input.name.en.trim() || input.name.id.trim(),
      zh: input.name.zh.trim() || input.name.id.trim(),
    },
    type: isLocationType(input.type) ? input.type : 'store',
    timezone: input.timezone.trim() || 'Asia/Jakarta',
    currency: input.currency.trim().toUpperCase() || 'IDR',
    address: input.address.trim() || null,
    status: isLocationStatus(input.status) ? input.status : 'active',
    updatedAt: new Date(),
    updatedBy: ctx.userId || null,
  };

  try {
    if (input.id) {
      const [before] = await db
        .select()
        .from(locations)
        .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.id, input.id)))
        .limit(1);
      if (!before) return { success: false, error: 'Lokasi tidak ditemukan.' };

      await db
        .update(locations)
        .set(values)
        .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.id, input.id)));

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'location',
        entityId: input.id,
        before: before as never,
        after: values as never,
      });

      revalidatePath('/settings/locations');
      return { success: true, id: input.id };
    }

    const id = generateId();
    await db.insert(locations).values({
      id,
      tenantId: ctx.tenantId,
      ...values,
      createdBy: ctx.userId || null,
    });

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'location',
      entityId: id,
      before: null,
      after: values as never,
    });

    revalidatePath('/settings/locations');
    return { success: true, id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menyimpan lokasi.',
    };
  }
}

export async function deleteLocation(input: { id: string }): Promise<LocationActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { success: false, error: 'Forbidden' };

  const id = input.id.trim();
  if (!id) return { success: false, error: 'Lokasi tidak valid.' };

  const [before] = await db
    .select()
    .from(locations)
    .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.id, id), isNull(locations.deletedAt)))
    .limit(1);
  if (!before) return { success: false, error: 'Lokasi tidak ditemukan.' };

  const deletedAt = new Date();
  await db
    .update(locations)
    .set({
      status: 'inactive',
      deletedAt,
      updatedAt: deletedAt,
      updatedBy: ctx.userId || null,
    })
    .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.id, id)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'location',
    entityId: id,
    before: before as never,
    after: { deletedAt: deletedAt.toISOString(), status: 'inactive' } as never,
  });

  revalidatePath('/settings/locations');
  return { success: true, id };
}
