/**
 * Whistleblower anonymity regression — verifies that
 * `submitWhistleblowerReport`:
 *   1. only persists a row into `whistleblower_reports`
 *   2. never writes to `audit_log` (which would carry userId, ip, ua)
 *   3. accepts only tenantId from the caller, not userId
 *
 * AGENTS.md F10 "Whistleblower = audit trail ANONIM": the persisted
 * trace must not be de-anonymizable, even by an admin with audit.read.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface InsertEvent {
  table: string;
  values: unknown;
}

const insertEvents: InsertEvent[] = [];

vi.mock('@erp/db', () => ({
  db: {
    insert: (table: { _: { name?: string }; [k: string]: unknown }) => ({
      values: (values: unknown) => {
        // Drizzle table objects carry their pg name in `_.name`; if the
        // mock cannot find it we fall back to the raw object reference
        // so the test still records the call.
        const tableName =
          (table as { _: { name?: string } })?._?.name ??
          (table as { name?: string })?.name ??
          'unknown';
        insertEvents.push({ table: String(tableName), values });
        return Promise.resolve();
      },
    }),
  },
}));

// We import the schema only to satisfy TypeScript — the mock above intercepts
// any `db.insert(...)` call before the table object matters.
import { submitWhistleblowerReport } from '../src/hr/whistleblower';

describe('whistleblower anonymity', () => {
  beforeEach(() => {
    insertEvents.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists the report row but never writes audit_log', async () => {
    const result = await submitWhistleblowerReport({
      tenantId: 'tenant-1',
      title: 'Alleged misconduct',
      category: 'fraud',
      content: 'Detailed description of the issue',
    });

    expect(result.ok).toBe(true);

    // Only the whistleblower row should have been written.
    const auditWrites = insertEvents.filter((event) => event.table.toLowerCase().includes('audit'));
    expect(auditWrites).toHaveLength(0);

    expect(insertEvents).toHaveLength(1);
    const persisted = insertEvents[0]?.values as Record<string, unknown>;
    expect(persisted.tenantId).toBe('tenant-1');
    expect(persisted.title).toBe('Alleged misconduct');
    expect(persisted.status).toBe('open');
    // No reporter identity in the persisted row.
    expect(persisted).not.toHaveProperty('createdByUserId');
    expect(persisted).not.toHaveProperty('updatedByUserId');
    expect(persisted).not.toHaveProperty('ipAddress');
    expect(persisted).not.toHaveProperty('userAgent');
  });

  it('rejects submissions without tenantId', async () => {
    const result = await submitWhistleblowerReport({
      tenantId: '',
      title: 'Test',
      category: 'fraud',
      content: 'Body',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects empty title / category / content', async () => {
    for (const overrides of [{ title: '   ' }, { category: '' }, { content: '' }]) {
      insertEvents.length = 0;
      const result = await submitWhistleblowerReport({
        tenantId: 'tenant-1',
        title: 'ok',
        category: 'fraud',
        content: 'ok',
        ...overrides,
      });
      expect(result.ok).toBe(false);
      expect(insertEvents).toHaveLength(0);
    }
  });

  it('refuses content larger than 8000 characters', async () => {
    const huge = 'a'.repeat(8001);
    const result = await submitWhistleblowerReport({
      tenantId: 'tenant-1',
      title: 'Big report',
      category: 'fraud',
      content: huge,
    });
    expect(result.ok).toBe(false);
    expect(insertEvents).toHaveLength(0);
  });
});
