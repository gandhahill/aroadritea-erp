/**
 * @erp/services/accounting — Accounting service barrel export.
 */

export { createJournal, type JournalEntryResult, type JournalLineResult } from './create-journal';
export { postJournal } from './post-journal';
export { reverseJournal } from './reverse-journal';
export { closePeriod, getPeriodStatus, type ClosePeriodResult, type PeriodStatusResult } from './close-period';
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
