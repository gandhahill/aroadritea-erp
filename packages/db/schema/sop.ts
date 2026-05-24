/**
 * SOP Document schema — User Req 2 (2026-05-24).
 *
 * Management uploads standard operating procedures (PDF / image / DOC)
 * that the rest of the company can read. Stored as an opaque file in
 * the existing upload-storage area "sop" so we reuse the auth-gated
 * download path at /api/uploads/private/sop/<fileKey>.
 */

import { pgTable, text, index, bigint } from 'drizzle-orm/pg-core';
import { auditCols, locationCol, pk, statusCol, tenantCol, versionCol } from './common';

export const sopDocuments = pgTable(
  'sop_documents',
  {
    ...pk,
    ...tenantCol,
    // Location is optional — `null` means the SOP applies to every
    // outlet (e.g. company-wide Code of Conduct). Per-outlet SOPs
    // (e.g. opening checklist for Malioboro) use a concrete locationId.
    locationId: text('location_id'),

    title: text('title').notNull(),
    description: text('description'),
    /** Free-form taxonomy (e.g. "operations", "hr", "safety"). */
    category: text('category').notNull().default('general'),

    /** Storage path returned by `/api/uploads` (e.g. `private/sop/<uuid>.pdf`). */
    fileKey: text('file_key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),

    /** Optional explicit publish date — null while a draft is being prepared. */
    publishedAt: text('published_at'),
    /** 'draft' | 'published' | 'archived' */
    ...statusCol('draft'),

    ...versionCol,
    ...auditCols,
    // locationCol is not used because we allow null above.
  },
  (table) => [
    index('sop_documents_tenant_idx').on(table.tenantId),
    index('sop_documents_status_idx').on(table.tenantId, table.status),
    index('sop_documents_category_idx').on(table.tenantId, table.category),
  ],
);

// locationCol is imported only so future migrations stay aligned with the
// rest of the codebase — silence the unused warning by re-exporting it.
export { locationCol as _sopLocationCol };
