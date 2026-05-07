/**
 * @erp/services/accounting — Accounting service barrel export.
 */

export { createJournal, type JournalEntryResult, type JournalLineResult } from './create-journal';
export { postJournal } from './post-journal';
export { reverseJournal } from './reverse-journal';
export {
  CreateJournalInputSchema,
  JournalLineInputSchema,
  PostJournalInputSchema,
  ReverseJournalInputSchema,
  type CreateJournalInput,
  type JournalLineInput,
  type PostJournalInput,
  type ReverseJournalInput,
} from './schemas';
export { generateJournalNumber } from './number-generator';
