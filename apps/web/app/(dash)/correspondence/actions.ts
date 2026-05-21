'use server';

import { getSession } from '@/lib/auth';
import { pickLocalized } from '@/lib/pick-localized';
import { and, asc, db, eq, isNull, locations, users } from '@erp/db';
import {
  createCorrespondence,
  deleteCorrespondence,
  getCorrespondence,
  listCorrespondence,
  updateCorrespondence,
  type CorrespondenceRecord,
} from '@erp/services/correspondence';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

export interface CorrespondenceOptions {
  locations: Array<{ id: string; label: string }>;
  users: Array<{ id: string; label: string }>;
}

export interface CorrespondencePageData extends CorrespondenceOptions {
  items: CorrespondenceRecord[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

function buildCtx(session: Awaited<ReturnType<typeof getSession>>): AuditContext {
  const user = session?.user as Record<string, unknown> | null;
  return {
    userId: String(user?.id ?? ''),
    tenantId: String(user?.tenantId ?? 'default'),
    locationId: String(user?.locationId ?? ''),
  };
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function tags(formData: FormData) {
  return text(formData, 'tags')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

async function getOptions(ctx: AuditContext): Promise<CorrespondenceOptions> {
  const rawLocale = await getLocale().catch(() => 'id');
  const locale = rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id';
  const [locationRows, userRows] = await Promise.all([
    db
      .select({ id: locations.id, code: locations.code, name: locations.name, type: locations.type })
      .from(locations)
      .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.status, 'active')))
      .orderBy(asc(locations.code)),
    db
      .select({ id: users.id, name: users.displayName, email: users.email })
      .from(users)
      .where(and(eq(users.tenantId, ctx.tenantId), eq(users.status, 'active'), isNull(users.deletedAt)))
      .orderBy(asc(users.displayName)),
  ]);
  return {
    locations: locationRows.map((location) => ({
      id: location.id,
      label: `${location.code} - ${pickLocalized(location.name, locale, location.code)} (${location.type})`,
    })),
    users: userRows.map((user) => ({
      id: user.id,
      label: `${user.name || user.email}`,
    })),
  };
}

export async function fetchCorrespondencePageData(searchParams: {
  page?: string;
  status?: string;
  direction?: string;
}): Promise<CorrespondencePageData> {
  const session = await getSession();
  if (!session) redirect('/login');
  const ctx = buildCtx(session);
  const page = Math.max(1, Number(searchParams.page ?? '1') || 1);
  const pageSize = 25;
  const [options, result] = await Promise.all([
    getOptions(ctx),
    listCorrespondence(
      {
        status: searchParams.status as never,
        direction: searchParams.direction as never,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      },
      ctx,
    ),
  ]);
  if (!result.ok) {
    return { ...options, items: [], total: 0, page, pageSize, error: result.error.messageKey };
  }
  return { ...options, ...result.value, page, pageSize };
}

export async function fetchCorrespondenceDetail(id: string) {
  const session = await getSession();
  if (!session) redirect('/login');
  const ctx = buildCtx(session);
  const [options, result] = await Promise.all([getOptions(ctx), getCorrespondence(id, ctx)]);
  if (!result.ok) return { ...options, record: null, error: result.error.messageKey };
  return { ...options, record: result.value };
}

export async function createCorrespondenceAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');
  const ctx = buildCtx(session);
  const result = await createCorrespondence(
    {
      locationId: text(formData, 'locationId') || ctx.locationId,
      direction: text(formData, 'direction') as never,
      documentNo: text(formData, 'documentNo'),
      subject: text(formData, 'subject'),
      counterparty: nullableText(formData, 'counterparty'),
      documentDate: text(formData, 'documentDate'),
      dueDate: nullableText(formData, 'dueDate'),
      channel: text(formData, 'channel') as never,
      classification: text(formData, 'classification') as never,
      priority: text(formData, 'priority') as never,
      ownerUserId: nullableText(formData, 'ownerUserId'),
      summary: nullableText(formData, 'summary'),
      storageUrl: nullableText(formData, 'storageUrl'),
      tags: tags(formData),
    },
    ctx,
  );
  revalidatePath('/correspondence');
  if (!result.ok) redirect(`/correspondence?error=${encodeURIComponent(result.error.messageKey)}`);
  redirect(`/correspondence/${result.value.id}`);
}

export async function updateCorrespondenceAction(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');
  const ctx = buildCtx(session);
  const result = await updateCorrespondence(
    id,
    {
      locationId: text(formData, 'locationId'),
      direction: text(formData, 'direction') as never,
      documentNo: text(formData, 'documentNo'),
      subject: text(formData, 'subject'),
      counterparty: nullableText(formData, 'counterparty'),
      documentDate: text(formData, 'documentDate'),
      dueDate: nullableText(formData, 'dueDate'),
      channel: text(formData, 'channel') as never,
      classification: text(formData, 'classification') as never,
      priority: text(formData, 'priority') as never,
      status: text(formData, 'status') as never,
      ownerUserId: nullableText(formData, 'ownerUserId'),
      summary: nullableText(formData, 'summary'),
      storageUrl: nullableText(formData, 'storageUrl'),
      tags: tags(formData),
    },
    ctx,
  );
  revalidatePath('/correspondence');
  revalidatePath(`/correspondence/${id}`);
  if (!result.ok) redirect(`/correspondence/${id}?error=${encodeURIComponent(result.error.messageKey)}`);
  redirect(`/correspondence/${id}?saved=1`);
}

export async function deleteCorrespondenceAction(id: string) {
  const session = await getSession();
  if (!session) redirect('/login');
  const ctx = buildCtx(session);
  const result = await deleteCorrespondence(id, ctx);
  revalidatePath('/correspondence');
  if (!result.ok) redirect(`/correspondence/${id}?error=${encodeURIComponent(result.error.messageKey)}`);
  redirect('/correspondence?deleted=1');
}
