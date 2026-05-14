import { beforeEach, describe, expect, it, vi } from 'vitest';

let selectCallIndex = 0;
let selectResults: unknown[][] = [];
let returningRows: unknown[] = [];
const insertCalls: unknown[] = [];
const deleteCalls: unknown[] = [];

function nextRows(): unknown[] {
  return selectResults[selectCallIndex++] ?? [];
}

function queryResult(rows: unknown[]) {
  const promise = Promise.resolve(rows);
  return {
    limit: () => Promise.resolve(rows),
    then: promise.then.bind(promise),
  };
}

vi.mock('@erp/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => queryResult(nextRows()),
        innerJoin: () => ({
          where: () => queryResult(nextRows()),
        }),
      }),
    }),
    insert: () => ({
      values: (value: unknown) => {
        insertCalls.push(value);
        const promise = Promise.resolve(undefined);
        return {
          returning: () => Promise.resolve(returningRows),
          then: promise.then.bind(promise),
        };
      },
    }),
    delete: () => ({
      where: (value: unknown) => {
        deleteCalls.push(value);
        return Promise.resolve();
      },
    }),
  },
}));

const requirePermission = vi.fn(async () => ({ ok: true, value: undefined }));

vi.mock('../src/iam', () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

import type { AuditContext } from '@erp/shared/types';
import {
  createJournalAttachment,
  deleteJournalAttachment,
  listJournalAttachments,
} from '../src/accounting/journal-attachments';

function ctx(overrides?: Partial<AuditContext>): AuditContext {
  return {
    userId: 'user-1',
    tenantId: 'default',
    locationId: 'loc-session',
    ...overrides,
  };
}

function attachmentRow(overrides?: Record<string, unknown>) {
  return {
    id: 'att-1',
    journalEntryId: 'je-1',
    fileKey: 'local:je-1/file.pdf',
    fileName: 'file.pdf',
    fileSize: 1000,
    mimeType: 'application/pdf',
    uploadedBy: 'user-1',
    uploadedAt: new Date('2026-05-14T10:00:00.000Z'),
    ...overrides,
  };
}

describe('journal attachment service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIndex = 0;
    selectResults = [];
    returningRows = [attachmentRow()];
    insertCalls.length = 0;
    deleteCalls.length = 0;
  });

  it('checks create permission against the journal location', async () => {
    selectResults = [[{ id: 'je-1', locationId: 'loc-plz' }]];

    const result = await createJournalAttachment(
      {
        journalEntryId: 'je-1',
        fileKey: 'local:je-1/file.pdf',
        fileName: 'file.pdf',
        fileSize: 1000,
        mimeType: 'application/pdf',
      },
      ctx(),
    );

    expect(result.ok).toBe(true);
    expect(requirePermission).toHaveBeenCalledWith('user-1', 'accounting.journal.create', {
      locationId: 'loc-plz',
    });
    expect(insertCalls).toHaveLength(2);
  });

  it('does not check permission when the journal is outside tenant scope', async () => {
    selectResults = [[]];

    const result = await createJournalAttachment(
      {
        journalEntryId: 'je-missing',
        fileKey: 'local:je-missing/file.pdf',
        fileName: 'file.pdf',
        fileSize: 1000,
        mimeType: 'application/pdf',
      },
      ctx(),
    );

    expect(result.ok).toBe(false);
    expect(requirePermission).not.toHaveBeenCalled();
  });

  it('checks list permission against the journal location', async () => {
    selectResults = [[{ id: 'je-1', locationId: 'loc-mli' }], [attachmentRow()]];

    const result = await listJournalAttachments('je-1', ctx());

    expect(result.ok).toBe(true);
    expect(requirePermission).toHaveBeenCalledWith('user-1', 'accounting.view', {
      locationId: 'loc-mli',
    });
  });

  it('checks delete permission against the journal location and tenant', async () => {
    selectResults = [[{ attachment: attachmentRow(), journalLocationId: 'loc-plz' }]];

    const result = await deleteJournalAttachment('att-1', ctx());

    expect(result.ok).toBe(true);
    expect(requirePermission).toHaveBeenCalledWith('user-1', 'accounting.journal.create', {
      locationId: 'loc-plz',
    });
    expect(deleteCalls).toHaveLength(1);
  });
});
