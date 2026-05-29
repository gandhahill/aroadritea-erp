/**
 * Correspondence schema — incoming, outgoing, and internal letters.
 *
 * The module is an administrative document register. It keeps metadata,
 * ownership, deadlines, and audit trail references; actual files can be
 * stored through the existing upload pipeline and linked by storageUrl.
 */

import { date, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { auditCols, locationCol, pk, tenantCol, versionCol } from './common';

export const correspondenceRecords = pgTable(
  'correspondence_records',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    direction: text('direction').notNull(),
    // 'incoming' | 'outgoing' | 'internal'
    documentNo: text('document_no').notNull(),
    subject: text('subject').notNull(),
    counterparty: text('counterparty'),
    documentDate: date('document_date').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    dueDate: date('due_date'),

    channel: text('channel').notNull().default('physical'),
    // 'physical' | 'email' | 'whatsapp' | 'courier' | 'other'
    classification: text('classification').notNull().default('general'),
    // 'general' | 'legal' | 'finance' | 'hr' | 'procurement' | 'tax' | 'other'
    priority: text('priority').notNull().default('normal'),
    // 'low' | 'normal' | 'high' | 'urgent'
    status: text('status').notNull().default('draft'),
    // 'draft' | 'registered' | 'in_progress' | 'sent' | 'closed' | 'archived'

    ownerUserId: text('owner_user_id'),
    summary: text('summary'),
    storageUrl: text('storage_url'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),

    // T-0261: Auto-nomor agenda, multi-lampiran, disposisi
    agendaNo: text('agenda_no'), // e.g. 'AGD-2026-05-001'
    attachments: jsonb('attachments').$type<string[]>().notNull().default([]), // array of storageUrls
    dispositions: jsonb('dispositions').$type<any[]>().notNull().default([]), // array of disposition objects

    ...versionCol,
    ...auditCols,
  },
  (t) => [
    uniqueIndex('correspondence_records_tenant_doc_no_idx').on(t.tenantId, t.documentNo),
    index('correspondence_records_tenant_location_idx').on(t.tenantId, t.locationId),
    index('correspondence_records_status_idx').on(t.status),
    index('correspondence_records_due_date_idx').on(t.dueDate),
    index('correspondence_records_owner_idx').on(t.ownerUserId),
  ],
);
