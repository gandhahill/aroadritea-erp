/**
 * @erp/services/accounting — Accounting service barrel export.
 */

export { createJournal, type JournalEntryResult, type JournalLineResult } from './create-journal';
export { CreateJournalInputSchema, JournalLineInputSchema, type CreateJournalInput, type JournalLineInput } from './schemas';
export { generateJournalNumber } from './number-generator';
