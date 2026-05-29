/**
 * Accounting Zod schemas — SD §10.4
 *
 * All inputs validated at service layer so both UI (Server Actions)
 * and MCP calls go through the same validation.
 */

import { z } from 'zod';

// --- Journal Line ---

export const JournalLineInputSchema = z.object({
  accountId: z.string().min(1, { message: 'Account ID is required' }),
  locationId: z.string().min(1, { message: 'Location ID is required' }),
  description: z.string().optional(),
  /** Debit amount as string (bigint). Must be "0" if credit > 0. */
  debit: z.string().regex(/^\d+$/, { message: 'Debit must be a non-negative integer string' }),
  /** Credit amount as string (bigint). Must be "0" if debit > 0. */
  credit: z.string().regex(/^\d+$/, { message: 'Credit must be a non-negative integer string' }),
  taxCode: z.string().optional(),
  partnerId: z.string().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Due date must be YYYY-MM-DD' })
    .optional(),
  reminderDaysBefore: z.number().int().min(0).max(365).optional(),
  expectedLossRateBps: z.number().int().min(0).max(10000).optional(),
});

export type JournalLineInput = z.infer<typeof JournalLineInputSchema>;

// --- Create Journal Entry ---

export const CreateJournalInputSchema = z.object({
  /** Posting date in YYYY-MM-DD format. */
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Posting date must be YYYY-MM-DD',
  }),
  /** Location ID for the journal entry header. */
  locationId: z.string().min(1, { message: 'Location ID is required' }),
  /** Human-readable description / memo. */
  description: z.string().min(1, { message: 'Description is required' }),
  /** Optional reference type for manual and automatic journals. */
  referenceType: z
    .enum([
      'sales',
      'sales_order',
      'purchase',
      'payroll',
      'manual',
      'stock_adjustment',
      'stock_transfer',
      'grn',
      'bank_deposit',
      'opening',
      'voucher_redeem',
      'fixed_asset_depreciation',
      'manual_sales_closing',
    ])
    .optional(),
  /** Optional reference entity ID. */
  referenceId: z.string().optional(),
  /** Journal lines — minimum 2 required. */
  lines: z.array(JournalLineInputSchema).min(2, {
    message: 'At least 2 journal lines are required',
  }),
  idempotencyKey: z.string().min(1).max(64).optional(),
});

export type CreateJournalInput = z.infer<typeof CreateJournalInputSchema>;

// --- Post Journal Entry ---

export const PostJournalInputSchema = z.object({
  /** ID of the journal entry to post. */
  journalId: z.string().min(1, { message: 'Journal ID is required' }),
});

export type PostJournalInput = z.infer<typeof PostJournalInputSchema>;

// --- Reverse Journal Entry ---

export const ReverseJournalInputSchema = z.object({
  /** ID of the journal entry to reverse. */
  journalId: z.string().min(1, { message: 'Journal ID is required' }),
  /** Posting date for the reversal JE. Must be in an open period. */
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Posting date must be YYYY-MM-DD',
  }),
});

export type ReverseJournalInput = z.infer<typeof ReverseJournalInputSchema>;

// --- Close Period ---

export const ClosePeriodInputSchema = z.object({
  /** Period code e.g. '2026-05'. */
  periodCode: z.string().regex(/^\d{4}-\d{2}$/, {
    message: 'Period code must be YYYY-MM',
  }),
  /**
   * If true, force close even if draft JEs exist (they will remain as drafts).
   * Default false — will reject if drafts exist.
   */
  force: z.boolean().optional().default(false),
});

export type ClosePeriodInput = z.input<typeof ClosePeriodInputSchema>;

// --- Get Period Status ---

export const GetPeriodStatusInputSchema = z.object({
  periodCode: z.string().regex(/^\d{4}-\d{2}$/, {
    message: 'Period code must be YYYY-MM',
  }),
});

export type GetPeriodStatusInput = z.infer<typeof GetPeriodStatusInputSchema>;

// --- Open Period ---

export const OpenPeriodInputSchema = z.object({
  periodCode: z.string().regex(/^\d{4}-\d{2}$/, {
    message: 'Period code must be YYYY-MM',
  }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Start date must be YYYY-MM-DD',
  }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'End date must be YYYY-MM-DD',
  }),
});

export type OpenPeriodInput = z.infer<typeof OpenPeriodInputSchema>;

// --- Petty Cash — Record Expense ---

export const RecordPettyCashExpenseSchema = z.object({
  locationId: z.string().min(1, { message: 'Location ID is required' }),
  amount: z.string().regex(/^[1-9]\d*$/, { message: 'Amount must be a positive integer string' }),
  description: z.string().min(1, { message: 'Description is required' }),
});

export type RecordPettyCashExpenseInput = z.infer<typeof RecordPettyCashExpenseSchema>;

// --- Petty Cash — Replenish (Topup) ---

export const ReplenishPettyCashSchema = z.object({
  locationId: z.string().min(1, { message: 'Location ID is required' }),
  amount: z.string().regex(/^[1-9]\d*$/, { message: 'Amount must be a positive integer string' }),
  description: z.string().optional().default('Replenish petty cash'),
});

export type ReplenishPettyCashInput = z.infer<typeof ReplenishPettyCashSchema>;

// --- Petty Cash — Deposit to bank ---

export const DepositPettyCashToBankSchema = z.object({
  locationId: z.string().min(1, { message: 'Location ID is required' }),
  amount: z.string().regex(/^[1-9]\d*$/, { message: 'Amount must be a positive integer string' }),
  description: z.string().optional().default('Setor kas kecil ke bank'),
});

export type DepositPettyCashToBankInput = z.infer<typeof DepositPettyCashToBankSchema>;

// --- Petty Cash — List Transactions ---

export const ListPettyCashTransactionsSchema = z.object({
  locationId: z.string().min(1, { message: 'Location ID is required' }),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export type ListPettyCashTransactionsInput = z.infer<typeof ListPettyCashTransactionsSchema>;

// --- Petty Cash — Create Account ---

export const CreatePettyCashAccountSchema = z.object({
  locationId: z.string().min(1, { message: 'Location ID is required' }),
  maxLimit: z
    .string()
    .regex(/^[1-9]\d*$/, { message: 'Max limit must be a positive integer string' }),
  // Initial cash handed over by the company at opening time (kas → kas
  // kecil). Defaults to maxLimit when omitted. When > 0 we post a journal:
  //   DR Petty Cash  <openingBalance>
  //   CR Cash        <openingBalance>
  openingBalance: z
    .string()
    .regex(/^\d+$/, { message: 'Opening balance must be a non-negative integer string' })
    .optional(),
});

export type CreatePettyCashAccountInput = z.infer<typeof CreatePettyCashAccountSchema>;

// --- Reimbursement — Create ---

export const CreateReimbursementSchema = z.object({
  locationId: z.string().min(1, { message: 'Location ID is required' }),
  amount: z.string().regex(/^[1-9]\d*$/, { message: 'Amount must be a positive integer string' }),
  category: z.enum(['operational', 'supplies', 'emergency', 'other']),
  description: z.string().min(1, { message: 'Description is required' }),
  attachmentUrl: z.string().url().optional(),
  attachmentName: z.string().optional(),
});

export type CreateReimbursementInput = z.infer<typeof CreateReimbursementSchema>;

// --- Reimbursement — Reject ---

export const RejectReimbursementSchema = z.object({
  id: z.string().min(1, { message: 'Reimbursement ID is required' }),
  reason: z.string().min(1, { message: 'Rejection reason is required' }),
});

export type RejectReimbursementInput = z.infer<typeof RejectReimbursementSchema>;

// --- Reimbursement — List ---

export const ListReimbursementsSchema = z.object({
  locationId: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'disbursed', 'rejected']).optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export type ListReimbursementsInput = z.infer<typeof ListReimbursementsSchema>;

// --- Journal Attachment — Create Record ---

export const CreateJournalAttachmentSchema = z.object({
  journalEntryId: z.string().min(1, { message: 'Journal entry ID is required' }),
  fileKey: z.string().min(1, { message: 'File key is required' }),
  fileName: z.string().min(1, { message: 'File name is required' }),
  fileSize: z.number().int().positive({ message: 'File size must be positive' }),
  mimeType: z.string().min(1, { message: 'MIME type is required' }),
});

export type CreateJournalAttachmentInput = z.infer<typeof CreateJournalAttachmentSchema>;

export const DepreciationMethodSchema = z.enum([
  'straight_line',
  'declining_balance',
  'double_declining_balance',
  'sum_of_years_digits',
  'units_of_production',
]);

export type DepreciationMethod = z.infer<typeof DepreciationMethodSchema>;

export const CreateFixedAssetSchema = z.object({
  locationId: z.string().min(1),
  categoryId: z.string().min(1),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(160),
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inServiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acquisitionCost: z.string().regex(/^[1-9]\d*$/),
  salvageValue: z.string().regex(/^\d+$/).optional().default('0'),
  usefulLifeMonths: z.number().int().min(1).max(600),
  depreciationMethod: DepreciationMethodSchema,
  depreciationRateBps: z.number().int().min(1).max(10000).optional(),
  productionCapacity: z
    .string()
    .regex(/^[1-9]\d*$/)
    .optional(),
  notes: z.string().max(1000).optional(),
});

export type CreateFixedAssetInput = z.input<typeof CreateFixedAssetSchema>;

export const UpdateFixedAssetCategorySchema = z.object({
  id: z.string().min(1),
  defaultUsefulLifeMonths: z.number().int().min(1).max(600),
  defaultDepreciationMethod: DepreciationMethodSchema,
  assetAccountId: z.string().min(1),
  accumulatedDepreciationAccountId: z.string().min(1),
  depreciationExpenseAccountId: z.string().min(1),
});

export type UpdateFixedAssetCategoryInput = z.input<typeof UpdateFixedAssetCategorySchema>;

export const ListFixedAssetsSchema = z.object({
  locationId: z.string().optional(),
  status: z.enum(['active', 'fully_depreciated', 'disposed']).optional(),
  limit: z.number().int().min(1).max(200).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});

export type ListFixedAssetsInput = z.input<typeof ListFixedAssetsSchema>;

export const RunFixedAssetDepreciationSchema = z.object({
  locationId: z.string().min(1),
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assetIds: z.array(z.string().min(1)).optional(),
  unitsUsedByAssetId: z.record(z.string(), z.string().regex(/^[1-9]\d*$/)).optional(),
  notes: z.string().max(1000).optional(),
});

export type RunFixedAssetDepreciationInput = z.infer<typeof RunFixedAssetDepreciationSchema>;

export const DisposeFixedAssetSchema = z.object({
  id: z.string().min(1),
  locationId: z.string().min(1),
  disposalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  salePrice: z.string().regex(/^\d+$/).optional().default('0'),
  saleAccountId: z.string().optional(),
  disposalNotes: z.string().max(1000).optional(),
});

export type DisposeFixedAssetInput = z.infer<typeof DisposeFixedAssetSchema>;
