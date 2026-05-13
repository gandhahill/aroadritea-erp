import { db } from '@erp/db';
import {
  cmsBanners,
  cmsFaqs,
  cmsPages,
  cmsPosts,
  cmsRevisions,
  cmsSettings,
} from '@erp/db/schema/cms';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
/**
 * CMS Service — SD §31.4
 *
 * CRUD + publish workflow for pages, posts, banners, FAQs, settings.
 * ISR revalidation handled by callers (API routes).
 */
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

// ─── Shared schemas ──────────────────────────────────────────────────────────

export const ContentLocalizedSchema = z.object({
  id: z.string().optional(),
  en: z.string(),
  zh: z.string(),
});

export const PublishPageSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['publish', 'draft', 'archive']),
});

export const PublishPostSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['publish', 'draft', 'archive']),
});

export const CreatePageSchema = z.object({
  tenantId: z.string().default('default'),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  type: z.enum(['page', 'landing', 'legal']).default('page'),
  title: ContentLocalizedSchema,
  content: ContentLocalizedSchema,
  status: z.enum(['draft', 'review', 'published', 'archived']).default('draft'),
  metaTitle: ContentLocalizedSchema.optional(),
  metaDescription: ContentLocalizedSchema.optional(),
  ogImageUrl: z.string().url().optional(),
  displayOrder: z.number().int().nonnegative().default(0),
  isInNavbar: z.boolean().default(false),
});

export const UpdatePageSchema = CreatePageSchema.partial().extend({
  id: z.string().min(1),
});

export const CreatePostSchema = z.object({
  tenantId: z.string().default('default'),
  kind: z.enum(['news', 'promo', 'recipe', 'event']).default('news'),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  title: ContentLocalizedSchema,
  content: ContentLocalizedSchema,
  excerpt: ContentLocalizedSchema.optional(),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'review', 'published', 'archived']).default('draft'),
  displayOrder: z.number().int().nonnegative().default(0),
});

export const UpdatePostSchema = CreatePostSchema.partial().extend({
  id: z.string().min(1),
});

export const CreateBannerSchema = z.object({
  tenantId: z.string().default('default'),
  title: ContentLocalizedSchema,
  subtitle: ContentLocalizedSchema.optional(),
  ctaLabel: ContentLocalizedSchema.optional(),
  ctaUrl: z.string().url().optional(),
  imageUrlDesktop: z.string().url(),
  imageUrlMobile: z.string().url().optional(),
  activeFrom: z.string().datetime().optional(),
  activeUntil: z.string().datetime().optional(),
  displayOrder: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

export const CreateFaqSchema = z.object({
  tenantId: z.string().default('default'),
  category: z.string().default('general'),
  question: ContentLocalizedSchema,
  answer: ContentLocalizedSchema,
  displayOrder: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

export type PublishPageInput = z.infer<typeof PublishPageSchema>;
export type PublishPostInput = z.infer<typeof PublishPostSchema>;
export type CreatePageInput = z.infer<typeof CreatePageSchema>;
export type UpdatePageInput = z.infer<typeof UpdatePageSchema>;
export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;
export type CreateBannerInput = z.infer<typeof CreateBannerSchema>;
export type CreateFaqInput = z.infer<typeof CreateFaqSchema>;

// ─── Pages ──────────────────────────────────────────────────────────────────

/** Get a single page by ID. */
export async function getPage(id: string): Promise<Result<Record<string, unknown>>> {
  try {
    const row = await db.select().from(cmsPages).where(eq(cmsPages.id, id)).limit(1);
    if (!row[0]) return err(AppError.notFound('cms.page.notFound'));
    return ok(row[0]);
  } catch (e) {
    return err(AppError.internal('cms.page.getFailed', e));
  }
}

/** List pages, optionally filtered by status. */
export async function listPages(
  tenantId: string,
  options?: { status?: string },
): Promise<Result<Array<Record<string, unknown>>>> {
  try {
    const conditions = [eq(cmsPages.tenantId, tenantId)];
    if (options?.status) conditions.push(eq(cmsPages.status, options.status));
    const rows = await db
      .select()
      .from(cmsPages)
      .where(and(...conditions))
      .orderBy(desc(cmsPages.updatedAt));
    return ok(rows);
  } catch (e) {
    return err(AppError.internal('cms.pages.listFailed', e));
  }
}

/** Create a new CMS page. */
export async function createPage(
  input: CreatePageInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = CreatePageSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('cms.page.validationFailed', { issues: parsed.error.issues }));
  }
  try {
    const newId = crypto.randomUUID();
    await db.insert(cmsPages).values({
      ...parsed.data,
      id: newId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
    return ok({ id: newId });
  } catch (e) {
    return err(AppError.internal('cms.page.createFailed', e));
  }
}

/** Update an existing CMS page. */
export async function updatePage(
  input: UpdatePageInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = UpdatePageSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('cms.page.validationFailed', { issues: parsed.error.issues }));
  }
  const { id, ...data } = parsed.data;
  try {
    await db
      .update(cmsPages)
      .set({ ...data, updatedBy: ctx.userId })
      .where(eq(cmsPages.id, id));
    return ok({ id });
  } catch (e) {
    return err(AppError.internal('cms.page.updateFailed', e));
  }
}

/** Publish / archive / draft a CMS page. */
export async function publishPage(
  input: PublishPageInput,
  ctx: AuditContext,
): Promise<Result<{ id: string; status: string }>> {
  const parsed = PublishPageSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('cms.page.validationFailed', { issues: parsed.error.issues }));
  }
  const { id, action } = parsed.data;
  const newStatus = action === 'publish' ? 'published' : action;
  try {
    await db
      .update(cmsPages)
      .set({ status: newStatus, updatedBy: ctx.userId })
      .where(eq(cmsPages.id, id));
    return ok({ id, status: newStatus });
  } catch (e) {
    return err(AppError.internal('cms.page.publishFailed', e));
  }
}

/** Soft-delete a CMS page. */
export async function deletePage(id: string, ctx: AuditContext): Promise<Result<void>> {
  try {
    await db
      .update(cmsPages)
      .set({ status: 'archived', updatedBy: ctx.userId })
      .where(eq(cmsPages.id, id));
    return ok(undefined);
  } catch (e) {
    return err(AppError.internal('cms.page.deleteFailed', e));
  }
}

// ─── Posts ─────────────────────────────────────────────────────────────────

/** Get a single post by ID. */
export async function getPost(id: string): Promise<Result<Record<string, unknown>>> {
  try {
    const row = await db.select().from(cmsPosts).where(eq(cmsPosts.id, id)).limit(1);
    if (!row[0]) return err(AppError.notFound('cms.post.notFound'));
    return ok(row[0]);
  } catch (e) {
    return err(AppError.internal('cms.post.getFailed', e));
  }
}

/** List posts, optionally filtered by kind/status. */
export async function listPosts(
  tenantId: string,
  options?: { kind?: string; status?: string },
): Promise<Result<Array<Record<string, unknown>>>> {
  try {
    const conditions = [eq(cmsPosts.tenantId, tenantId)];
    if (options?.kind) conditions.push(eq(cmsPosts.kind, options.kind));
    if (options?.status) conditions.push(eq(cmsPosts.status, options.status));
    const rows = await db
      .select()
      .from(cmsPosts)
      .where(and(...conditions))
      .orderBy(desc(cmsPosts.updatedAt));
    return ok(rows);
  } catch (e) {
    return err(AppError.internal('cms.posts.listFailed', e));
  }
}

/** Create a new blog post. */
export async function createPost(
  input: CreatePostInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = CreatePostSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('cms.post.validationFailed', { issues: parsed.error.issues }));
  }
  try {
    const newId = crypto.randomUUID();
    await db.insert(cmsPosts).values({
      ...parsed.data,
      id: newId,
      authorUserId: ctx.userId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
    return ok({ id: newId });
  } catch (e) {
    return err(AppError.internal('cms.post.createFailed', e));
  }
}

/** Update an existing blog post. */
export async function updatePost(
  input: UpdatePostInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = UpdatePostSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('cms.post.validationFailed', { issues: parsed.error.issues }));
  }
  const { id, ...data } = parsed.data;
  try {
    await db
      .update(cmsPosts)
      .set({ ...data, updatedBy: ctx.userId })
      .where(eq(cmsPosts.id, id));
    return ok({ id });
  } catch (e) {
    return err(AppError.internal('cms.post.updateFailed', e));
  }
}

/** Publish / archive / draft a blog post. */
export async function publishPost(
  input: PublishPostInput,
  ctx: AuditContext,
): Promise<Result<{ id: string; status: string }>> {
  const parsed = PublishPostSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('cms.post.validationFailed', { issues: parsed.error.issues }));
  }
  const { id, action } = parsed.data;
  const newStatus = action === 'publish' ? 'published' : action;
  try {
    await db
      .update(cmsPosts)
      .set({ status: newStatus, updatedBy: ctx.userId })
      .where(eq(cmsPosts.id, id));
    return ok({ id, status: newStatus });
  } catch (e) {
    return err(AppError.internal('cms.post.publishFailed', e));
  }
}

/** Soft-delete a blog post. */
export async function deletePost(id: string, ctx: AuditContext): Promise<Result<void>> {
  try {
    await db
      .update(cmsPosts)
      .set({ status: 'archived', updatedBy: ctx.userId })
      .where(eq(cmsPosts.id, id));
    return ok(undefined);
  } catch (e) {
    return err(AppError.internal('cms.post.deleteFailed', e));
  }
}

// ─── Banners ────────────────────────────────────────────────────────────────

/** List banners, optionally only active ones. */
export async function listBanners(
  tenantId: string,
  options?: { activeOnly?: boolean },
): Promise<Result<Array<Record<string, unknown>>>> {
  try {
    const conditions = [eq(cmsBanners.tenantId, tenantId)];
    if (options?.activeOnly) {
      conditions.push(eq(cmsBanners.isActive, true));
    }
    const rows = await db
      .select()
      .from(cmsBanners)
      .where(and(...conditions))
      .orderBy(cmsBanners.displayOrder);
    return ok(rows);
  } catch (e) {
    return err(AppError.internal('cms.banners.listFailed', e));
  }
}

// ─── FAQs ───────────────────────────────────────────────────────────────────

/** List FAQs, optionally only active ones. */
export async function listFaqs(
  tenantId: string,
  options?: { activeOnly?: boolean; category?: string },
): Promise<Result<Array<Record<string, unknown>>>> {
  try {
    const conditions = [eq(cmsFaqs.tenantId, tenantId)];
    if (options?.activeOnly) conditions.push(eq(cmsFaqs.isActive, true));
    if (options?.category) conditions.push(eq(cmsFaqs.category, options.category));
    const rows = await db
      .select()
      .from(cmsFaqs)
      .where(and(...conditions))
      .orderBy(cmsFaqs.displayOrder);
    return ok(rows);
  } catch (e) {
    return err(AppError.internal('cms.faqs.listFailed', e));
  }
}

// ─── Settings ───────────────────────────────────────────────────────────────

/** Get a site setting by key. */
export async function getSetting(
  tenantId: string,
  key: string,
): Promise<Result<Record<string, unknown> | null>> {
  try {
    const row = await db
      .select()
      .from(cmsSettings)
      .where(and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, key)))
      .limit(1);
    return ok(row[0] ?? null);
  } catch (e) {
    return err(AppError.internal('cms.settings.getFailed', e));
  }
}

/** Upsert a site setting. */
export async function setSetting(
  tenantId: string,
  key: string,
  value: unknown,
  ctx: AuditContext,
): Promise<Result<void>> {
  try {
    const existing = await db
      .select({ id: cmsSettings.id })
      .from(cmsSettings)
      .where(and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, key)))
      .limit(1);

    if (existing[0]) {
      await db
        .update(cmsSettings)
        .set({ value, updatedBy: ctx.userId })
        .where(eq(cmsSettings.id, existing[0].id));
    } else {
      await db.insert(cmsSettings).values({
        id: crypto.randomUUID(),
        tenantId,
        key,
        value,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }
    return ok(undefined);
  } catch (e) {
    return err(AppError.internal('cms.settings.setFailed', e));
  }
}
