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
  /** Optional reference type (e.g., 'sales', 'purchase', 'payroll', 'manual'). */
  referenceType: z.enum(['sales', 'purchase', 'payroll', 'manual']).optional(),
  /** Optional reference entity ID. */
  referenceId: z.string().optional(),
  /** Journal lines — minimum 2 required. */
  lines: z.array(JournalLineInputSchema).min(2, {
    message: 'At least 2 journal lines are required',
  }),
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
