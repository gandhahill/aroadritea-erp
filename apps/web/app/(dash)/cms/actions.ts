/**
 * CMS — Server Actions (SD §31.3)
 * All mutations go through this layer.
 */
'use server';

import { getSession } from '@/lib/auth';
import {
  createPage,
  createPost,
  deletePage,
  deletePost,
  getPage,
  getPost,
  listBanners,
  listFaqs,
  listPages,
  listPosts,
  publishPage,
  publishPost,
  updatePage,
  updatePost,
} from '@erp/services/cms';
import { requirePermission } from '@erp/services/iam';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

type ActionResult = { success: boolean; error?: string };

function buildCtx(session: Awaited<ReturnType<typeof getSession>>): AuditContext {
  const user = session?.user as Record<string, unknown> | null;
  return {
    userId: (user?.id as string) ?? 'system',
    tenantId: (user?.tenantId as string) ?? 'default',
    locationId: (user?.locationId as string) ?? 'default',
  };
}

// ─── Pages ────────────────────────────────────────────────────────────────

export async function fetchCmsPages(status?: string) {
  const session = await getSession();
  if (!session) return [];
  const ctx = buildCtx(session);
  const perm = await requirePermission(ctx.userId, 'cms.view');
  if (!perm.ok) return [];
  const result = await listPages(ctx.tenantId, status ? { status } : undefined);
  if (!result.ok) return [];
  return result.value;
}

export async function fetchCmsPage(id: string) {
  const session = await getSession();
  if (!session) return null;
  const ctx = buildCtx(session);
  const perm = await requirePermission(ctx.userId, 'cms.view');
  if (!perm.ok) return null;
  const result = await getPage(id, ctx.tenantId);
  if (!result.ok) return null;
  return result.value;
}

export async function createCmsPage(data: Record<string, unknown>): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };
  const ctx = buildCtx(session);
  const result = await createPage(data as Parameters<typeof createPage>[0], ctx);
  if (!result.ok) return { success: false, error: String(result.error) };
  revalidatePath('/cms/pages');
  return { success: true };
}

export async function updateCmsPage(
  id: string,
  data: Record<string, unknown>,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };
  const ctx = buildCtx(session);
  const result = await updatePage({ id, ...data } as Parameters<typeof updatePage>[0], ctx);
  if (!result.ok) return { success: false, error: String(result.error) };
  revalidatePath('/cms/pages');
  return { success: true };
}

export async function publishCmsPage(
  id: string,
  action: 'publish' | 'draft' | 'archive',
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };
  const ctx = buildCtx(session);
  const result = await publishPage({ id, action }, ctx);
  if (!result.ok) return { success: false, error: String(result.error) };
  revalidatePath('/cms/pages');
  revalidatePath('/[locale]/[slug]', 'page');
  return { success: true };
}

export async function deleteCmsPage(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };
  const ctx = buildCtx(session);
  const result = await deletePage(id, ctx);
  if (!result.ok) return { success: false, error: String(result.error) };
  revalidatePath('/cms/pages');
  return { success: true };
}

// ─── Posts ──────────────────────────────────────────────────────────────

export async function fetchCmsPosts(options?: { kind?: string; status?: string }) {
  const session = await getSession();
  if (!session) return [];
  const ctx = buildCtx(session);
  const perm = await requirePermission(ctx.userId, 'cms.view');
  if (!perm.ok) return [];
  const result = await listPosts(ctx.tenantId, options);
  if (!result.ok) return [];
  return result.value;
}

export async function fetchCmsPost(id: string) {
  const session = await getSession();
  if (!session) return null;
  const ctx = buildCtx(session);
  const perm = await requirePermission(ctx.userId, 'cms.view');
  if (!perm.ok) return null;
  const result = await getPost(id, ctx.tenantId);
  if (!result.ok) return null;
  return result.value;
}

export async function createCmsPost(data: Record<string, unknown>): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };
  const ctx = buildCtx(session);
  const result = await createPost(data as Parameters<typeof createPost>[0], ctx);
  if (!result.ok) return { success: false, error: String(result.error) };
  revalidatePath('/cms/posts');
  return { success: true };
}

export async function updateCmsPost(
  id: string,
  data: Record<string, unknown>,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };
  const ctx = buildCtx(session);
  const result = await updatePost({ id, ...data } as Parameters<typeof updatePost>[0], ctx);
  if (!result.ok) return { success: false, error: String(result.error) };
  revalidatePath('/cms/posts');
  return { success: true };
}

export async function publishCmsPost(
  id: string,
  action: 'publish' | 'draft' | 'archive',
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };
  const ctx = buildCtx(session);
  const result = await publishPost({ id, action }, ctx);
  if (!result.ok) return { success: false, error: String(result.error) };
  revalidatePath('/cms/posts');
  revalidatePath('/[locale]/blog/[slug]', 'page');
  return { success: true };
}

export async function deleteCmsPost(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };
  const ctx = buildCtx(session);
  const result = await deletePost(id, ctx);
  if (!result.ok) return { success: false, error: String(result.error) };
  revalidatePath('/cms/posts');
  return { success: true };
}

// ─── Banners ────────────────────────────────────────────────────────────

export async function fetchCmsBanners(activeOnly = false) {
  const session = await getSession();
  if (!session) return [];
  const ctx = buildCtx(session);
  const perm = await requirePermission(ctx.userId, 'cms.view');
  if (!perm.ok) return [];
  const result = await listBanners(ctx.tenantId, { activeOnly });
  if (!result.ok) return [];
  return result.value;
}

// ─── FAQs ────────────────────────────────────────────────────────────────

export async function fetchCmsFaqs(options?: { activeOnly?: boolean; category?: string }) {
  const session = await getSession();
  if (!session) return [];
  const ctx = buildCtx(session);
  const perm = await requirePermission(ctx.userId, 'cms.view');
  if (!perm.ok) return [];
  const result = await listFaqs(ctx.tenantId, options);
  if (!result.ok) return [];
  return result.value;
}
