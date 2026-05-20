/**
 * Accounting schema — SD §9.2
 *
 * Tables: accounting_periods, accounts (COA), journal_entries,
 *         journal_lines, partners, tax_rates
 */

import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
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
import { users } from './auth';
import { auditCols, pk, tenantCol, versionCol } from './common';

// ================================================================
// ACCOUNTING PERIODS — SD §9.2
// ================================================================

export const accountingPeriods = pgTable(
  'accounting_periods',
  {
    ...pk,
    ...tenantCol,
    code: text('code').notNull(), // '2026-05'
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
    code: text('code').notNull(), // '1-1100', '4-1100'
    name: jsonb('name').notNull(), // LocaleString { id, en, zh }
    type: text('type').notNull(), // 'asset' | 'liability' | 'equity' | 'income' | 'cogs' | 'expense'
    subtype: text('subtype').notNull(), // 'current_asset', 'fixed_asset', 'contra_asset', etc.
    parentId: text('parent_id'), // self-referencing hierarchy
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
    number: text('number').notNull(), // 'JE-2026-05-0001'
    description: text('description').notNull(),
    referenceType: text('reference_type'), // 'sales' | 'purchase' | 'payroll' | 'manual'
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
    debit: bigint('debit', { mode: 'bigint' }).notNull().default(sql`0`),
    credit: bigint('credit', { mode: 'bigint' }).notNull().default(sql`0`),
    taxCode: text('tax_code'),
    partnerId: text('partner_id'),
    dueDate: date('due_date'),
    reminderDaysBefore: integer('reminder_days_before'),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    expectedLossRateBps: integer('expected_loss_rate_bps'),
  },
  (t) => [
    index('jl_journal_entry_idx').on(t.journalEntryId),
    index('jl_account_idx').on(t.accountId),
    index('jl_partner_idx').on(t.partnerId),
    index('jl_due_date_idx').on(t.dueDate),
    check(
      'jl_debit_credit_exclusive',
      sql`(debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)`,
    ),
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
    kind: text('kind').notNull(), // 'customer' | 'supplier' | 'employee' | 'other'
    name: text('name').notNull(),
    nameLocalized: jsonb('name_localized'), // LocaleString (optional)
    npwp: text('npwp'),
    email: text('email'),
    phone: text('phone'), // encrypted at-rest (UU PDP)
    address: text('address'),
    birthDate: timestamp('birth_date', { withTimezone: true }),
    city: text('city'),
    isPkp: boolean('is_pkp').notNull().default(false),
    isMember: boolean('is_member').notNull().default(false),
    loyaltyTier: text('loyalty_tier').default('bronze'),
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
    code: text('code').notNull(), // 'PB1', 'PPN_OUT', 'PPN_IN', 'PPH21', 'PPH23'
    name: jsonb('name').notNull(), // LocaleString
    rateBps: integer('rate_bps').notNull(), // basis points: 10% = 1000
    calculation: text('calculation').notNull(), // 'inclusive' | 'exclusive'
    postingAccountId: text('posting_account_id').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    effectiveFrom: date('effective_from').notNull(),
    effectiveUntil: date('effective_until'), // NULL = forever
    ...auditCols,
  },
  (t) => [uniqueIndex('tax_rates_code_idx').on(t.code)],
);

// ================================================================
// TAX RULES — SD §19.3.2 (PPN opt-in engine, ADR-0010)
// ================================================================

export const taxRules = pgTable(
  'tax_rules',
  {
    ...pk,
    ...tenantCol,
    scopeKind: text('scope_kind').notNull(), // 'channel' | 'customer_segment' | 'product_category' | 'global_default'
    scopeId: text('scope_id'), // id of channel/segment/category — NULL for global_default
    taxCode: text('tax_code').notNull(), // FK to tax_rates.code
    isAppliedDefault: boolean('is_applied_default').notNull().default(true),
    priority: integer('priority').notNull().default(10), // higher = more specific
    effectiveFrom: date('effective_from').notNull(),
    effectiveUntil: date('effective_until'), // NULL = forever
    ...auditCols,
  },
  (t) => [
    index('tax_rules_scope_idx').on(t.scopeKind, t.scopeId),
    index('tax_rules_tax_code_idx').on(t.taxCode),
    index('tax_rules_tenant_idx').on(t.tenantId),
    check(
      'tax_rules_scope_kind_check',
      sql`scope_kind IN ('channel', 'customer_segment', 'product_category', 'global_default')`,
    ),
  ],
);

// ================================================================
// PETTY CASH ACCOUNTS — SD §25.7
// ================================================================

export const pettyCashAccounts = pgTable(
  'petty_cash_accounts',
  {
    ...pk,
    ...tenantCol,
    locationId: text('location_id').notNull(),
    balance: bigint('balance', { mode: 'bigint' }).notNull().default(sql`0`),
    maxLimit: bigint('max_limit', { mode: 'bigint' }).notNull(),
    lastReplenishAt: timestamp('last_replenish_at', { withTimezone: true }),
    ...auditCols,
  },
  (t) => [
    uniqueIndex('petty_cash_acct_tenant_location_idx').on(t.tenantId, t.locationId),
    index('petty_cash_acct_tenant_idx').on(t.tenantId),
  ],
);

// ================================================================
// PETTY CASH TRANSACTIONS — SD §25.7
// ================================================================

export const pettyCashTransactions = pgTable(
  'petty_cash_transactions',
  {
    ...pk,
    accountId: text('account_id').notNull(),
    kind: text('kind').notNull(), // 'topup' | 'expense'
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    description: text('description').notNull(),
    referenceType: text('reference_type'), // 'replenish_request' | 'manual'
    referenceId: text('reference_id'),
    ...auditCols,
  },
  (t) => [
    index('petty_cash_tx_account_idx').on(t.accountId),
    index('petty_cash_tx_kind_idx').on(t.kind),
    index('petty_cash_tx_created_idx').on(t.createdAt),
    check('petty_cash_tx_kind_check', sql`kind IN ('topup', 'expense')`),
    check('petty_cash_tx_amount_positive', sql`amount > 0`),
  ],
);

// ================================================================
// REIMBURSEMENT REQUESTS — SD §25.8
// ================================================================

export const reimbursementRequests = pgTable(
  'reimbursement_requests',
  {
    ...pk,
    ...tenantCol,
    requesterId: text('requester_id').notNull(),
    locationId: text('location_id').notNull(),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    category: text('category').notNull(), // 'operational' | 'supplies' | 'emergency' | 'other'
    description: text('description').notNull(),
    attachmentUrl: text('attachment_url'),
    attachmentName: text('attachment_name'),
    status: text('status').notNull().default('draft'), // 'draft' | 'submitted' | 'approved' | 'disbursed' | 'rejected'
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    disbursedAt: timestamp('disbursed_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    ...auditCols,
  },
  (t) => [
    index('reimb_tenant_status_idx').on(t.tenantId, t.status),
    index('reimb_requester_idx').on(t.requesterId),
    index('reimb_location_idx').on(t.locationId),
    index('reimb_created_idx').on(t.createdAt),
    check(
      'reimb_category_check',
      sql`category IN ('operational', 'supplies', 'emergency', 'other')`,
    ),
    check(
      'reimb_status_check',
      sql`status IN ('draft', 'submitted', 'approved', 'disbursed', 'rejected')`,
    ),
    check('reimb_amount_positive', sql`amount > 0`),
  ],
);

// ================================================================
// FIXED ASSET CATEGORIES — SoT §10.4
// ================================================================

export const fixedAssetCategories = pgTable(
  'fixed_asset_categories',
  {
    ...pk,
    ...tenantCol,
    code: text('code').notNull(),
    name: jsonb('name').notNull(),
    assetAccountId: text('asset_account_id').notNull(),
    accumulatedDepreciationAccountId: text('accumulated_depreciation_account_id').notNull(),
    depreciationExpenseAccountId: text('depreciation_expense_account_id').notNull(),
    defaultUsefulLifeMonths: integer('default_useful_life_months').notNull(),
    defaultDepreciationMethod: text('default_depreciation_method')
      .notNull()
      .default('straight_line'),
    isActive: boolean('is_active').notNull().default(true),
    ...auditCols,
    ...versionCol,
  },
  (t) => [
    uniqueIndex('fixed_asset_cat_tenant_code_idx').on(t.tenantId, t.code),
    index('fixed_asset_cat_tenant_active_idx').on(t.tenantId, t.isActive),
    check('fixed_asset_cat_life_positive', sql`default_useful_life_months > 0`),
    check(
      'fixed_asset_cat_method_check',
      sql`default_depreciation_method IN ('straight_line', 'declining_balance', 'double_declining_balance', 'sum_of_years_digits', 'units_of_production')`,
    ),
  ],
);

// ================================================================
// FIXED ASSETS — SoT §10.4
// ================================================================

export const fixedAssets = pgTable(
  'fixed_assets',
  {
    ...pk,
    ...tenantCol,
    locationId: text('location_id').notNull(),
    categoryId: text('category_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    acquisitionDate: date('acquisition_date').notNull(),
    inServiceDate: date('in_service_date').notNull(),
    acquisitionCost: bigint('acquisition_cost', { mode: 'bigint' }).notNull(),
    salvageValue: bigint('salvage_value', { mode: 'bigint' }).notNull().default(sql`0`),
    usefulLifeMonths: integer('useful_life_months').notNull(),
    depreciationMethod: text('depreciation_method').notNull().default('straight_line'),
    depreciationRateBps: integer('depreciation_rate_bps'),
    productionCapacity: bigint('production_capacity', { mode: 'bigint' }),
    accumulatedDepreciation: bigint('accumulated_depreciation', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    lastDepreciationDate: date('last_depreciation_date'),
    status: text('status').notNull().default('active'),
    disposalDate: date('disposal_date'),
    disposalAmount: bigint('disposal_amount', { mode: 'bigint' }),
    disposalJournalEntryId: text('disposal_journal_entry_id'),
    notes: text('notes'),
    ...auditCols,
    ...versionCol,
  },
  (t) => [
    uniqueIndex('fixed_assets_tenant_code_idx').on(t.tenantId, t.code),
    index('fixed_assets_tenant_location_idx').on(t.tenantId, t.locationId),
    index('fixed_assets_category_idx').on(t.categoryId),
    index('fixed_assets_status_idx').on(t.status),
    check('fixed_asset_cost_positive', sql`acquisition_cost > 0`),
    check('fixed_asset_salvage_non_negative', sql`salvage_value >= 0`),
    check('fixed_asset_life_positive', sql`useful_life_months > 0`),
    check('fixed_asset_status_check', sql`status IN ('active', 'fully_depreciated', 'disposed')`),
    check(
      'fixed_asset_method_check',
      sql`depreciation_method IN ('straight_line', 'declining_balance', 'double_declining_balance', 'sum_of_years_digits', 'units_of_production')`,
    ),
  ],
);

// ================================================================
// FIXED ASSET DEPRECIATION RUNS — auto-journal batch header
// ================================================================

export const fixedAssetDepreciationRuns = pgTable(
  'fixed_asset_depreciation_runs',
  {
    ...pk,
    ...tenantCol,
    locationId: text('location_id').notNull(),
    periodId: text('period_id').notNull(),
    postingDate: date('posting_date').notNull(),
    status: text('status').notNull().default('posted'),
    totalAmount: bigint('total_amount', { mode: 'bigint' }).notNull(),
    journalEntryId: text('journal_entry_id'),
    notes: text('notes'),
    ...auditCols,
    ...versionCol,
  },
  (t) => [
    index('fixed_asset_dep_runs_tenant_period_idx').on(t.tenantId, t.periodId),
    index('fixed_asset_dep_runs_location_idx').on(t.locationId),
    index('fixed_asset_dep_runs_journal_idx').on(t.journalEntryId),
    check('fixed_asset_dep_runs_amount_non_negative', sql`total_amount >= 0`),
    check('fixed_asset_dep_runs_status_check', sql`status IN ('posted', 'void')`),
  ],
);

// ================================================================
// FIXED ASSET DEPRECIATION LINES — per-asset schedule result
// ================================================================

export const fixedAssetDepreciationLines = pgTable(
  'fixed_asset_depreciation_lines',
  {
    ...pk,
    runId: text('run_id').notNull(),
    assetId: text('asset_id').notNull(),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    accumulatedAfter: bigint('accumulated_after', { mode: 'bigint' }).notNull(),
    bookValueAfter: bigint('book_value_after', { mode: 'bigint' }).notNull(),
    unitsUsed: bigint('units_used', { mode: 'bigint' }),
    ...auditCols,
  },
  (t) => [
    uniqueIndex('fixed_asset_dep_lines_run_asset_idx').on(t.runId, t.assetId),
    index('fixed_asset_dep_lines_asset_idx').on(t.assetId),
    check('fixed_asset_dep_lines_amount_positive', sql`amount > 0`),
  ],
);

// ================================================================
// JOURNAL ATTACHMENTS — SD §25.10
// ================================================================

export const journalAttachments = pgTable(
  'journal_attachments',
  {
    ...pk,
    journalEntryId: text('journal_entry_id').notNull(),
    fileKey: text('file_key').notNull(),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size').notNull(),
    mimeType: text('mime_type').notNull(),
    uploadedBy: text('uploaded_by'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('journal_attach_je_idx').on(t.journalEntryId),
    index('journal_attach_uploaded_idx').on(t.uploadedAt),
  ],
);

// ================================================================
// RELATIONS
// ================================================================

export const accountingPeriodsRelations = relations(accountingPeriods, ({ one }) => ({
  closedByUser: one(users, { fields: [accountingPeriods.closedBy], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  parent: one(accounts, {
    fields: [accounts.parentId],
    references: [accounts.id],
    relationName: 'parent_child',
  }),
  children: many(accounts, { relationName: 'parent_child' }),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  period: one(accountingPeriods, {
    fields: [journalEntries.periodId],
    references: [accountingPeriods.id],
  }),
  lines: many(journalLines),
  attachments: many(journalAttachments),
  reversedBy: one(journalEntries, {
    fields: [journalEntries.reversedByJeId],
    references: [journalEntries.id],
    relationName: 'reversal',
  }),
}));

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalLines.journalEntryId],
    references: [journalEntries.id],
  }),
  account: one(accounts, { fields: [journalLines.accountId], references: [accounts.id] }),
  partner: one(partners, { fields: [journalLines.partnerId], references: [partners.id] }),
}));

export const taxRatesRelations = relations(taxRates, ({ one, many }) => ({
  postingAccount: one(accounts, { fields: [taxRates.postingAccountId], references: [accounts.id] }),
  rules: many(taxRules),
}));

export const taxRulesRelations = relations(taxRules, ({ one }) => ({
  taxRate: one(taxRates, { fields: [taxRules.taxCode], references: [taxRates.code] }),
}));

export const pettyCashAccountsRelations = relations(pettyCashAccounts, ({ many }) => ({
  transactions: many(pettyCashTransactions),
}));

export const pettyCashTransactionsRelations = relations(pettyCashTransactions, ({ one }) => ({
  account: one(pettyCashAccounts, {
    fields: [pettyCashTransactions.accountId],
    references: [pettyCashAccounts.id],
  }),
  createdByUser: one(users, { fields: [pettyCashTransactions.createdBy], references: [users.id] }),
}));

export const reimbursementRequestsRelations = relations(reimbursementRequests, ({ one }) => ({
  requester: one(users, {
    fields: [reimbursementRequests.requesterId],
    references: [users.id],
    relationName: 'requester',
  }),
  approver: one(users, {
    fields: [reimbursementRequests.approvedBy],
    references: [users.id],
    relationName: 'approver',
  }),
}));

export const fixedAssetCategoriesRelations = relations(fixedAssetCategories, ({ one, many }) => ({
  assetAccount: one(accounts, {
    fields: [fixedAssetCategories.assetAccountId],
    references: [accounts.id],
    relationName: 'fixed_asset_category_asset_account',
  }),
  accumulatedDepreciationAccount: one(accounts, {
    fields: [fixedAssetCategories.accumulatedDepreciationAccountId],
    references: [accounts.id],
    relationName: 'fixed_asset_category_accumulated_account',
  }),
  depreciationExpenseAccount: one(accounts, {
    fields: [fixedAssetCategories.depreciationExpenseAccountId],
    references: [accounts.id],
    relationName: 'fixed_asset_category_expense_account',
  }),
  assets: many(fixedAssets),
}));

export const fixedAssetsRelations = relations(fixedAssets, ({ one, many }) => ({
  category: one(fixedAssetCategories, {
    fields: [fixedAssets.categoryId],
    references: [fixedAssetCategories.id],
  }),
  depreciationLines: many(fixedAssetDepreciationLines),
}));

export const fixedAssetDepreciationRunsRelations = relations(
  fixedAssetDepreciationRuns,
  ({ one, many }) => ({
    period: one(accountingPeriods, {
      fields: [fixedAssetDepreciationRuns.periodId],
      references: [accountingPeriods.id],
    }),
    journalEntry: one(journalEntries, {
      fields: [fixedAssetDepreciationRuns.journalEntryId],
      references: [journalEntries.id],
    }),
    lines: many(fixedAssetDepreciationLines),
  }),
);

export const fixedAssetDepreciationLinesRelations = relations(
  fixedAssetDepreciationLines,
  ({ one }) => ({
    run: one(fixedAssetDepreciationRuns, {
      fields: [fixedAssetDepreciationLines.runId],
      references: [fixedAssetDepreciationRuns.id],
    }),
    asset: one(fixedAssets, {
      fields: [fixedAssetDepreciationLines.assetId],
      references: [fixedAssets.id],
    }),
  }),
);

export const journalAttachmentsRelations = relations(journalAttachments, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalAttachments.journalEntryId],
    references: [journalEntries.id],
  }),
  uploader: one(users, { fields: [journalAttachments.uploadedBy], references: [users.id] }),
}));
