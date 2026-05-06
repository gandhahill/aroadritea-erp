/**
 * Accounting schema — SD §9.2
 *
 * Tables: accounting_periods, accounts (COA), journal_entries,
 *         journal_lines, partners, tax_rates
 */

import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { auditCols, pk, tenantCol, versionCol } from './common';
import { users } from './auth';

// ================================================================
// ACCOUNTING PERIODS — SD §9.2
// ================================================================

export const accountingPeriods = pgTable(
  'accounting_periods',
  {
    ...pk,
    ...tenantCol,
    code: text('code').notNull(),            // '2026-05'
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: text('status').notNull().default('open'), // 'open' | 'closing' | 'closed'
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: text('closed_by'),
    ...auditCols,
  },
  (t) => [
    uniqueIndex('periods_tenant_code_idx').on(t.tenantId, t.code),
    index('periods_status_idx').on(t.status),
  ],
);

// ================================================================
// ACCOUNTS (COA) — SD §9.2
// ================================================================

export const accounts = pgTable(
  'accounts',
  {
    ...pk,
    ...tenantCol,
    code: text('code').notNull(),             // '1-1010', '4-1000'
    name: jsonb('name').notNull(),            // LocaleString { id, en, zh }
    type: text('type').notNull(),             // 'asset' | 'liability' | 'equity' | 'income' | 'cogs' | 'expense'
    subtype: text('subtype').notNull(),       // 'current_asset', 'fixed_asset', 'contra_asset', etc.
    parentId: text('parent_id'),             // self-referencing hierarchy
    normalBalance: text('normal_balance').notNull(), // 'debit' | 'credit'
    isPostable: boolean('is_postable').notNull().default(true),
    taxCode: text('tax_code'),
    isActive: boolean('is_active').notNull().default(true),
    ...auditCols,
    ...versionCol,
  },
  (t) => [
    uniqueIndex('accounts_tenant_code_idx').on(t.tenantId, t.code),
    index('accounts_type_idx').on(t.type),
    index('accounts_parent_idx').on(t.parentId),
  ],
);

// ================================================================
// JOURNAL ENTRIES — SD §9.2
// ================================================================

export const journalEntries = pgTable(
  'journal_entries',
  {
    ...pk,
    ...tenantCol,
    locationId: text('location_id').notNull(),
    periodId: text('period_id').notNull(),
    postingDate: date('posting_date').notNull(),
    number: text('number').notNull(),          // 'JE-2026-05-0001'
    description: text('description').notNull(),
    referenceType: text('reference_type'),     // 'sales' | 'purchase' | 'payroll' | 'manual'
    referenceId: text('reference_id'),
    status: text('status').notNull().default('draft'), // 'draft' | 'posted' | 'reversed'
    postedAt: timestamp('posted_at', { withTimezone: true }),
    postedBy: text('posted_by'),
    reversedByJeId: text('reversed_by_je_id'), // self-ref if reversed
    totalDebit: bigint('total_debit', { mode: 'bigint' }).notNull(),
    totalCredit: bigint('total_credit', { mode: 'bigint' }).notNull(),
    ...auditCols,
    ...versionCol,
  },
  (t) => [
    uniqueIndex('je_tenant_number_idx').on(t.tenantId, t.number),
    index('je_period_idx').on(t.periodId),
    index('je_posting_date_idx').on(t.postingDate),
    index('je_status_idx').on(t.status),
    index('je_location_idx').on(t.locationId),
    index('je_reference_idx').on(t.referenceType, t.referenceId),
    check('je_balanced', sql`total_debit = total_credit`),
  ],
);

// ================================================================
// JOURNAL LINES — SD §9.2
// ================================================================

export const journalLines = pgTable(
  'journal_lines',
  {
    ...pk,
    journalEntryId: text('journal_entry_id').notNull(),
    lineNo: integer('line_no').notNull(),
    accountId: text('account_id').notNull(),
    locationId: text('location_id').notNull(),
    description: text('description'),
    debit: bigint('debit', { mode: 'bigint' }).notNull().default(0n),
    credit: bigint('credit', { mode: 'bigint' }).notNull().default(0n),
    taxCode: text('tax_code'),
    partnerId: text('partner_id'),
  },
  (t) => [
    index('jl_journal_entry_idx').on(t.journalEntryId),
    index('jl_account_idx').on(t.accountId),
    index('jl_partner_idx').on(t.partnerId),
    check('jl_debit_credit_exclusive',
      sql`(debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)`),
  ],
);

// ================================================================
// PARTNERS — SD §9.2 (unified customer / supplier / employee)
// ================================================================

export const partners = pgTable(
  'partners',
  {
    ...pk,
    ...tenantCol,
    kind: text('kind').notNull(),              // 'customer' | 'supplier' | 'employee' | 'other'
    name: text('name').notNull(),
    nameLocalized: jsonb('name_localized'),    // LocaleString (optional)
    npwp: text('npwp'),
    email: text('email'),
    phone: text('phone'),                     // encrypted at-rest (UU PDP)
    address: text('address'),
    isPkp: boolean('is_pkp').notNull().default(false),
    paymentTermsDays: integer('payment_terms_days').default(0),
    isActive: boolean('is_active').notNull().default(true),
    ...auditCols,
    ...versionCol,
  },
  (t) => [
    index('partners_tenant_kind_idx').on(t.tenantId, t.kind),
    index('partners_name_idx').on(t.name),
  ],
);

// ================================================================
// TAX RATES — SD §9.2
// ================================================================

export const taxRates = pgTable(
  'tax_rates',
  {
    ...pk,
    code: text('code').notNull(),              // 'PB1', 'PPN_OUT', 'PPN_IN', 'PPH21', 'PPH23'
    name: jsonb('name').notNull(),             // LocaleString
    rateBps: integer('rate_bps').notNull(),    // basis points: 10% = 1000
    calculation: text('calculation').notNull(), // 'inclusive' | 'exclusive'
    postingAccountId: text('posting_account_id').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    effectiveFrom: date('effective_from').notNull(),
    effectiveUntil: date('effective_until'),   // NULL = forever
    ...auditCols,
  },
  (t) => [
    uniqueIndex('tax_rates_code_idx').on(t.code),
  ],
);

// ================================================================
// RELATIONS
// ================================================================

export const accountingPeriodsRelations = relations(accountingPeriods, ({ one }) => ({
  closedByUser: one(users, { fields: [accountingPeriods.closedBy], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  parent: one(accounts, { fields: [accounts.parentId], references: [accounts.id], relationName: 'parent_child' }),
  children: many(accounts, { relationName: 'parent_child' }),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  period: one(accountingPeriods, { fields: [journalEntries.periodId], references: [accountingPeriods.id] }),
  lines: many(journalLines),
  reversedBy: one(journalEntries, { fields: [journalEntries.reversedByJeId], references: [journalEntries.id], relationName: 'reversal' }),
}));

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  journalEntry: one(journalEntries, { fields: [journalLines.journalEntryId], references: [journalEntries.id] }),
  account: one(accounts, { fields: [journalLines.accountId], references: [accounts.id] }),
  partner: one(partners, { fields: [journalLines.partnerId], references: [partners.id] }),
}));

export const taxRatesRelations = relations(taxRates, ({ one }) => ({
  postingAccount: one(accounts, { fields: [taxRates.postingAccountId], references: [accounts.id] }),
}));
