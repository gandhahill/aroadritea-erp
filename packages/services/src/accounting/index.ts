/**
 * @erp/services/accounting — Accounting service barrel export.
 */

export { createJournal, type JournalEntryResult, type JournalLineResult } from './create-journal';
export { postJournal } from './post-journal';
export { reverseJournal } from './reverse-journal';
export {
  closePeriod,
  getPeriodStatus,
  type ClosePeriodResult,
  type PeriodStatusResult,
} from './close-period';
export {
  CreateJournalInputSchema,
  JournalLineInputSchema,
  PostJournalInputSchema,
  ReverseJournalInputSchema,
  ClosePeriodInputSchema,
  GetPeriodStatusInputSchema,
  type CreateJournalInput,
  type JournalLineInput,
  type PostJournalInput,
  type ReverseJournalInput,
  type ClosePeriodInput,
  type GetPeriodStatusInput,
} from './schemas';
export { generateJournalNumber } from './number-generator';
export {
  getPettyCashBalance,
  listPettyCashTransactions,
  recordPettyCashExpense,
  replenishPettyCash,
  depositPettyCashToBank,
  createPettyCashAccount,
  type PettyCashAccountResult,
  type PettyCashTransactionResult,
  type PettyCashTransactionListResult,
} from './petty-cash';
export {
  RecordPettyCashExpenseSchema,
  ReplenishPettyCashSchema,
  DepositPettyCashToBankSchema,
  ListPettyCashTransactionsSchema,
  CreatePettyCashAccountSchema,
  type RecordPettyCashExpenseInput,
  type ReplenishPettyCashInput,
  type DepositPettyCashToBankInput,
  type ListPettyCashTransactionsInput,
  type CreatePettyCashAccountInput,
  CreateReimbursementSchema,
  RejectReimbursementSchema,
  ListReimbursementsSchema,
  type CreateReimbursementInput,
  type RejectReimbursementInput,
  type ListReimbursementsInput,
} from './schemas';
export {
  createReimbursement,
  submitReimbursement,
  approveReimbursement,
  disburseReimbursement,
  rejectReimbursement,
  listReimbursements,
  getStaleReimbursements,
  type ReimbursementResult,
  type ReimbursementListResult,
} from './reimbursement';
export {
  createJournalAttachment,
  listJournalAttachments,
  deleteJournalAttachment,
  getJournalWithAttachments,
  type JournalAttachmentResult,
  type JournalWithAttachmentsResult,
} from './journal-attachments';
export {
  CreateJournalAttachmentSchema,
  type CreateJournalAttachmentInput,
  CreateFixedAssetSchema,
  ListFixedAssetsSchema,
  RunFixedAssetDepreciationSchema,
  type CreateFixedAssetInput,
  type ListFixedAssetsInput,
  type RunFixedAssetDepreciationInput,
  type DepreciationMethod,
} from './schemas';
export {
  createFixedAsset,
  listFixedAssets,
  listFixedAssetCategories,
  runFixedAssetDepreciation,
  type FixedAssetCategoryItem,
  type FixedAssetListItem,
  type DepreciationRunResult,
} from './fixed-assets';
export {
  resolveAccountIdByCode,
  resolveAccountIdsByCodes,
  requireAccountIdByCode,
} from './account-resolver';
