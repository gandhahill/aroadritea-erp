import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { auditCols, pk, tenantCol, versionCol } from './common';
import { relations } from 'drizzle-orm';
import { users } from './auth';

/**
 * Whistleblower Reports schema
 * Anonymous channel for reporting violations.
 * Created by user identity is explicitly omitted to ensure anonymity.
 */
export const whistleblowerReports = pgTable('whistleblower_reports', {
  ...pk,
  ...tenantCol,

  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('open'), // 'open' | 'investigating' | 'resolved'
  resolutionNotes: text('resolution_notes'),

  // auditCols includes createdByUserId. Since we need it to be anonymous, we omit createdByUserId
  // However, we want to track who updated it (e.g. HR Admin changing status).
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByUserId: text('updated_by_user_id'),

  ...versionCol,
});

export const whistleblowerReportsRelations = relations(whistleblowerReports, ({ one }) => ({
  // Note: No createdByUser relation
  updatedByUser: one(users, {
    fields: [whistleblowerReports.updatedByUserId],
    references: [users.id],
  }),
}));
