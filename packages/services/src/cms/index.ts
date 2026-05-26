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
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

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

export const ERP_DOCS_SETTING_KEY = 'erp_docs_content';

export const DocsLocaleSchema = z.enum(['id', 'en', 'zh']);

export const DocsLocaleContentSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(400).default(''),
  body: z.string().min(1).max(500_000),
});

export const EditableDocsContentSchema = z.object({
  id: DocsLocaleContentSchema,
  en: DocsLocaleContentSchema,
  zh: DocsLocaleContentSchema,
});

export const ReplaceDocsContentSchema = z.object({
  tenantId: z.string().min(1).default('default'),
  content: EditableDocsContentSchema,
  reason: z.string().max(500).optional(),
});

export const ReplaceDocsLocaleSchema = z.object({
  tenantId: z.string().min(1).default('default'),
  locale: DocsLocaleSchema,
  content: DocsLocaleContentSchema,
  fallbackContent: EditableDocsContentSchema.optional(),
  reason: z.string().max(500).optional(),
});

export type DocsLocale = z.infer<typeof DocsLocaleSchema>;
export type EditableDocsLocaleContent = z.infer<typeof DocsLocaleContentSchema>;
export type EditableDocsContent = z.infer<typeof EditableDocsContentSchema>;
export type ReplaceDocsContentInput = z.infer<typeof ReplaceDocsContentSchema>;
export type ReplaceDocsLocaleInput = z.infer<typeof ReplaceDocsLocaleSchema>;

function normalizeDocsContent(
  value: unknown,
  fallback?: EditableDocsContent,
): Result<EditableDocsContent> {
  const parsed = EditableDocsContentSchema.safeParse(value);
  if (parsed.success) return ok(parsed.data);
  if (fallback) return ok(fallback);
  return err(AppError.validation('cms.docs.fullContentRequired', { issues: parsed.error.issues }));
}

// ─── Pages ──────────────────────────────────────────────────────────────────

/** Get a single page by ID, scoped to the caller's tenant. */
export async function getPage(
  id: string,
  tenantId: string,
): Promise<Result<Record<string, unknown>>> {
  try {
    // Tenant-scope the lookup — otherwise any authenticated user could
    // read another tenant's CMS page if they knew its UUID.
    const row = await db
      .select()
      .from(cmsPages)
      .where(and(eq(cmsPages.id, id), eq(cmsPages.tenantId, tenantId)))
      .limit(1);
    if (!row[0]) return err(AppError.notFound('cms.page.notFound'));
    return ok(row[0]);
  } catch (e) {
    return err(AppError.internal('cms.page.getFailed', e));
  }
}

/** Get a published page by slug (for public site rendering). */
export async function getPublishedPageBySlug(
  tenantId: string,
  slug: string,
): Promise<Result<Record<string, unknown>>> {
  try {
    const row = await db
      .select()
      .from(cmsPages)
      .where(
        and(
          eq(cmsPages.tenantId, tenantId),
          eq(cmsPages.slug, slug),
          eq(cmsPages.status, 'published'),
        ),
      )
      .limit(1);
    if (!row[0]) return err(AppError.notFound('cms.page.notFound'));
    return ok(row[0]);
  } catch (e) {
    return err(AppError.internal('cms.page.getFailed', e));
  }
}

/** List all published pages (for public site nav/sitemap). */
export async function listPublishedPages(
  tenantId: string,
): Promise<Result<Array<Record<string, unknown>>>> {
  try {
    const rows = await db
      .select()
      .from(cmsPages)
      .where(and(eq(cmsPages.tenantId, tenantId), eq(cmsPages.status, 'published')))
      .orderBy(cmsPages.displayOrder);
    return ok(rows);
  } catch (e) {
    return err(AppError.internal('cms.pages.listFailed', e));
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
  const permCheck = await requirePermission(ctx.userId, 'cms.manage', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

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

    await auditRecord({
      action: 'create',
      entityType: 'cms_page',
      entityId: newId,
      before: null,
      after: {
        id: newId,
        slug: parsed.data.slug,
        title: parsed.data.title,
        status: parsed.data.status,
      },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
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
  const permCheck = await requirePermission(ctx.userId, 'cms.manage', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = UpdatePageSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('cms.page.validationFailed', { issues: parsed.error.issues }));
  }
  const { id, ...data } = parsed.data;
  try {
    const claimed = await db
      .update(cmsPages)
      .set({ ...data, updatedBy: ctx.userId })
      .where(and(eq(cmsPages.id, id), eq(cmsPages.tenantId, ctx.tenantId)))
      .returning({ id: cmsPages.id });
    if (claimed.length === 0) return err(AppError.notFound('cms.page.notFound'));

    await auditRecord({
      action: 'update',
      entityType: 'cms_page',
      entityId: id,
      before: null,
      after: { id, ...data },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

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
  const permCheck = await requirePermission(ctx.userId, 'cms.manage', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = PublishPageSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('cms.page.validationFailed', { issues: parsed.error.issues }));
  }
  const { id, action } = parsed.data;
  const newStatus = action === 'publish' ? 'published' : action;
  try {
    const claimed = await db
      .update(cmsPages)
      .set({ status: newStatus, updatedBy: ctx.userId })
      .where(and(eq(cmsPages.id, id), eq(cmsPages.tenantId, ctx.tenantId)))
      .returning({ id: cmsPages.id });
    if (claimed.length === 0) return err(AppError.notFound('cms.page.notFound'));

    await auditRecord({
      action: 'update',
      entityType: 'cms_page',
      entityId: id,
      before: null,
      after: { id, status: newStatus },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    return ok({ id, status: newStatus });
  } catch (e) {
    return err(AppError.internal('cms.page.publishFailed', e));
  }
}

/** Soft-delete a CMS page. */
export async function deletePage(id: string, ctx: AuditContext): Promise<Result<void>> {
  const permCheck = await requirePermission(ctx.userId, 'cms.manage', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    // Tenant-scope the archive — without it any authenticated user could
    // archive another tenant's CMS page by guessing its UUID.
    const claimed = await db
      .update(cmsPages)
      .set({ status: 'archived', updatedBy: ctx.userId })
      .where(and(eq(cmsPages.id, id), eq(cmsPages.tenantId, ctx.tenantId)))
      .returning({ id: cmsPages.id });
    if (claimed.length === 0) {
      return err(AppError.notFound('cms.page.notFound'));
    }

    await auditRecord({
      action: 'delete',
      entityType: 'cms_page',
      entityId: id,
      before: null,
      after: { id, status: 'archived' },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    return ok(undefined);
  } catch (e) {
    return err(AppError.internal('cms.page.deleteFailed', e));
  }
}

// ─── Posts ─────────────────────────────────────────────────────────────────

/** Get a single post by ID, scoped to the caller's tenant. */
export async function getPost(
  id: string,
  tenantId: string,
): Promise<Result<Record<string, unknown>>> {
  try {
    // Tenant-scope the lookup — otherwise any authenticated user could
    // read another tenant's CMS post if they knew its UUID.
    const row = await db
      .select()
      .from(cmsPosts)
      .where(and(eq(cmsPosts.id, id), eq(cmsPosts.tenantId, tenantId)))
      .limit(1);
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

/**
 * Public — list every published post for the given tenant. Used by the
 * public site `/blog` index. No auth required.
 */
export async function listPublishedPosts(
  tenantId: string,
  options?: { kind?: string; limit?: number },
): Promise<Result<Array<Record<string, unknown>>>> {
  try {
    const conditions = [eq(cmsPosts.tenantId, tenantId), eq(cmsPosts.status, 'published')];
    if (options?.kind) conditions.push(eq(cmsPosts.kind, options.kind));
    const rows = await db
      .select()
      .from(cmsPosts)
      .where(and(...conditions))
      .orderBy(desc(cmsPosts.updatedAt))
      .limit(options?.limit ?? 50);
    return ok(rows);
  } catch (e) {
    return err(AppError.internal('cms.posts.listFailed', e));
  }
}

/**
 * Public — fetch a single published post by slug. Used by
 * `/blog/[slug]` on the public site.
 */
export async function getPublishedPostBySlug(
  tenantId: string,
  slug: string,
): Promise<Result<Record<string, unknown> | null>> {
  try {
    const [row] = await db
      .select()
      .from(cmsPosts)
      .where(
        and(
          eq(cmsPosts.tenantId, tenantId),
          eq(cmsPosts.slug, slug),
          eq(cmsPosts.status, 'published'),
        ),
      )
      .limit(1);
    return ok(row ?? null);
  } catch (e) {
    return err(AppError.internal('cms.post.getFailed', e));
  }
}

/** Create a new blog post. */
export async function createPost(
  input: CreatePostInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'cms.manage', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

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

    await auditRecord({
      action: 'create',
      entityType: 'cms_post',
      entityId: newId,
      before: null,
      after: {
        id: newId,
        slug: parsed.data.slug,
        title: parsed.data.title,
        status: parsed.data.status,
      },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
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
  const permCheck = await requirePermission(ctx.userId, 'cms.manage', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = UpdatePostSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('cms.post.validationFailed', { issues: parsed.error.issues }));
  }
  const { id, ...data } = parsed.data;
  try {
    const claimed = await db
      .update(cmsPosts)
      .set({ ...data, updatedBy: ctx.userId })
      .where(and(eq(cmsPosts.id, id), eq(cmsPosts.tenantId, ctx.tenantId)))
      .returning({ id: cmsPosts.id });
    if (claimed.length === 0) return err(AppError.notFound('cms.post.notFound'));

    await auditRecord({
      action: 'update',
      entityType: 'cms_post',
      entityId: id,
      before: null,
      after: { id, ...data },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

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
  const permCheck = await requirePermission(ctx.userId, 'cms.manage', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = PublishPostSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('cms.post.validationFailed', { issues: parsed.error.issues }));
  }
  const { id, action } = parsed.data;
  const newStatus = action === 'publish' ? 'published' : action;
  try {
    const claimed = await db
      .update(cmsPosts)
      .set({ status: newStatus, updatedBy: ctx.userId })
      .where(and(eq(cmsPosts.id, id), eq(cmsPosts.tenantId, ctx.tenantId)))
      .returning({ id: cmsPosts.id });
    if (claimed.length === 0) return err(AppError.notFound('cms.post.notFound'));

    await auditRecord({
      action: 'update',
      entityType: 'cms_post',
      entityId: id,
      before: null,
      after: { id, status: newStatus },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    return ok({ id, status: newStatus });
  } catch (e) {
    return err(AppError.internal('cms.post.publishFailed', e));
  }
}

/** Soft-delete a blog post (tenant-scoped). */
export async function deletePost(id: string, ctx: AuditContext): Promise<Result<void>> {
  const permCheck = await requirePermission(ctx.userId, 'cms.manage', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const claimed = await db
      .update(cmsPosts)
      .set({ status: 'archived', updatedBy: ctx.userId })
      .where(and(eq(cmsPosts.id, id), eq(cmsPosts.tenantId, ctx.tenantId)))
      .returning({ id: cmsPosts.id });
    if (claimed.length === 0) {
      return err(AppError.notFound('cms.post.notFound'));
    }

    await auditRecord({
      action: 'delete',
      entityType: 'cms_post',
      entityId: id,
      before: null,
      after: { id, status: 'archived' },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

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

/** Get the editable ERP docs setting row. */
export async function getDocsContent(
  tenantId: string,
): Promise<Result<Record<string, unknown> | null>> {
  return getSetting(tenantId, ERP_DOCS_SETTING_KEY);
}

/** Replace the full editable ERP docs content. This is explicit by design: seed never overwrites it. */
export async function replaceDocsContent(
  input: ReplaceDocsContentInput,
  ctx: AuditContext,
): Promise<Result<void>> {
  const permCheck = await requirePermission(ctx.userId, 'docs.edit', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = ReplaceDocsContentSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('cms.docs.validationFailed', { issues: parsed.error.issues }));
  }

  const { tenantId, content, reason } = parsed.data;

  try {
    const existing = await db
      .select({ id: cmsSettings.id, value: cmsSettings.value })
      .from(cmsSettings)
      .where(and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, ERP_DOCS_SETTING_KEY)))
      .limit(1);

    const existingRow = existing[0] ?? null;
    const id = existingRow?.id ?? crypto.randomUUID();

    if (existingRow) {
      await db
        .update(cmsSettings)
        .set({ value: content, updatedBy: ctx.userId, updatedAt: new Date() })
        .where(eq(cmsSettings.id, existingRow.id));
    } else {
      await db.insert(cmsSettings).values({
        id,
        tenantId,
        key: ERP_DOCS_SETTING_KEY,
        value: content,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    await auditRecord({
      action: existingRow ? 'update' : 'create',
      entityType: 'cms_settings',
      entityId: id,
      before: existingRow
        ? {
            key: ERP_DOCS_SETTING_KEY,
            value: existingRow.value,
          }
        : null,
      after: {
        key: ERP_DOCS_SETTING_KEY,
        value: content,
      },
      metadata: {
        purpose: 'erp_docs_content',
        reason: reason ?? null,
      },
      ctx,
    });

    return ok(undefined);
  } catch (e) {
    return err(AppError.internal('cms.docs.replaceFailed', e));
  }
}

/** Replace only one docs locale, preserving the other languages from existing content. */
export async function replaceDocsLocale(
  input: ReplaceDocsLocaleInput,
  ctx: AuditContext,
): Promise<Result<void>> {
  const parsed = ReplaceDocsLocaleSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('cms.docs.validationFailed', { issues: parsed.error.issues }));
  }

  const current = await getDocsContent(parsed.data.tenantId);
  if (!current.ok) return current;

  const normalized = normalizeDocsContent(current.value?.value, parsed.data.fallbackContent);
  if (!normalized.ok) return normalized;

  const next = {
    ...normalized.value,
    [parsed.data.locale]: parsed.data.content,
  };

  return replaceDocsContent(
    {
      tenantId: parsed.data.tenantId,
      content: next,
      reason: parsed.data.reason,
    },
    ctx,
  );
}

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
  const permCheck = await requirePermission(ctx.userId, 'cms.manage', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

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
