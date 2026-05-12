/**
 * CMS Schema — SD §31.2
 *
 * Tables:
 * - cms_pages   — static pages (beranda, tentang, menu, etc.)
 * - cms_posts  — blog/news/promo posts
 * - cms_banners — hero/promo banners with schedule
 * - cms_faqs   — FAQ items
 * - cms_settings — key-value site config
 * - cms_revisions — content history
 */

import { index, pgTable, uniqueIndex } from 'drizzle-orm/pg-core';
import { boolean, integer, jsonb, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { pk, auditCols } from './common';

// ─── cms_pages ────────────────────────────────────────────────────────────

export const cmsPages = pgTable('cms_pages', {
  ...pk,
  tenantId: text('tenant_id').notNull().default('default'),
  slug: text('slug').notNull(),
  type: text('type').notNull(), // 'page' | 'landing' | 'legal'
  title: jsonb('title').notNull(),
  content: jsonb('content').notNull(),
  status: text('status').notNull().default('draft'), // 'draft' | 'review' | 'published' | 'archived'
  publishedAt: timestamp('published_at', { withTimezone: true }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  metaTitle: jsonb('meta_title'),
  metaDescription: jsonb('meta_description'),
  ogImageUrl: text('og_image_url'),
  displayOrder: integer('display_order').notNull().default(0),
  isInNavbar: boolean('is_in_navbar').notNull().default(false),
  ...auditCols,
}, (table) => ({
  tenantSlugUq: uniqueIndex('cms_pages_tenant_slug_uq').on(table.tenantId, table.slug),
}));

// ─── cms_posts ──────────────────────────────────────────────────────────

export const cmsPosts = pgTable('cms_posts', {
  ...pk,
  tenantId: text('tenant_id').notNull().default('default'),
  kind: text('kind').notNull(), // 'news' | 'promo' | 'recipe' | 'event'
  slug: text('slug').notNull(),
  title: jsonb('title').notNull(),
  content: jsonb('content').notNull(),
  excerpt: jsonb('excerpt'),
  coverImageUrl: text('cover_image_url'),
  tags: text('tags').array(),
  authorUserId: text('author_user_id'),
  status: text('status').notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  metaTitle: jsonb('meta_title'),
  metaDescription: jsonb('meta_description'),
  ogImageUrl: text('og_image_url'),
  displayOrder: integer('display_order').notNull().default(0),
  ...auditCols,
}, (table) => ({
  tenantSlugUq: uniqueIndex('cms_posts_tenant_slug_uq').on(table.tenantId, table.slug),
}));

// ─── cms_banners ─────────────────────────────────────────────────────

export const cmsBanners = pgTable('cms_banners', {
  ...pk,
  tenantId: text('tenant_id').notNull().default('default'),
  title: jsonb('title').notNull(),
  subtitle: jsonb('subtitle'),
  ctaLabel: jsonb('cta_label'),
  ctaUrl: text('cta_url'),
  imageUrlDesktop: text('image_url_desktop').notNull(),
  imageUrlMobile: text('image_url_mobile'),
  activeFrom: timestamp('active_from', { withTimezone: true }),
  activeUntil: timestamp('active_until', { withTimezone: true }),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  ...auditCols,
});

// ─── cms_faqs ──────────────────────────────────────────────────────────

export const cmsFaqs = pgTable('cms_faqs', {
  ...pk,
  tenantId: text('tenant_id').notNull().default('default'),
  category: text('category').notNull().default('general'),
  question: jsonb('question').notNull(),
  answer: jsonb('answer').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  ...auditCols,
});

// ─── cms_settings ────────────────────────────────────────────────────

export const cmsSettings = pgTable('cms_settings', {
  ...pk,
  tenantId: text('tenant_id').notNull().default('default'),
  key: varchar('key', { length: 64 }).notNull(),
  value: jsonb('value').notNull(),
  ...auditCols,
}, (table) => ({
  tenantKeyUq: uniqueIndex('cms_settings_tenant_key_uq').on(table.tenantId, table.key),
}));

// ─── cms_revisions ──────────────────────────────────────────────────

export const cmsRevisions = pgTable('cms_revisions', {
  ...pk,
  tenantId: text('tenant_id').notNull().default('default'),
  entityType: text('entity_type').notNull(), // 'cms_page' | 'cms_post'
  entityId: text('entity_id').notNull(),
  snapshot: jsonb('snapshot').notNull(),
  changedBy: text('changed_by').notNull(),
  ...auditCols,
});
