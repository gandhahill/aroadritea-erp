import { describe, expect, it, vi, beforeEach } from 'vitest';
import { claimIdempotency, saveIdempotency, releaseIdempotencyClaim } from '../src/shared/idempotency';

let selectRows: any[] = [];
let inserts: any[] = [];
let updates: any[] = [];

vi.mock('@erp/db', () => ({
  db: {
    select: () => ({
      from: () => {
        const chain = {
          where: () => chain,
          then: (resolve: any) => resolve(selectRows)
        };
        return chain;
      }
    }),
    insert: () => ({
      values: (val: any) => {
        inserts.push(val);
        return {
          onConflictDoNothing: () => ({
            returning: () => {
              if (selectRows.length > 0) return Promise.resolve([]); // Simulate conflict
              return Promise.resolve([{ id: val.id }]);
            }
          }),
          onConflictDoUpdate: () => Promise.resolve()
        };
      }
    }),
    update: () => ({
      set: (val: any) => {
        updates.push(val);
        return {
          where: () => Promise.resolve()
        };
      }
    }),
  },
  eq: () => undefined,
  and: () => undefined
}));

describe('Idempotency System (Mocked DB)', () => {
  beforeEach(() => {
    selectRows = [];
    inserts = [];
    updates = [];
  });

  it('claims idempotency successfully if key is new', async () => {
    const result = await claimIdempotency('loc-1', 'new-key', 'pos.createSale');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBeDefined();
    expect(inserts.length).toBe(1);
    expect(inserts[0].idempotencyKey).toBe('new-key');
  });

  it('fails with duplicate error if key is fully processed', async () => {
    selectRows = [{ id: 'idem-1', responseStatus: 200, responseBody: { saleId: '123' } }];
    const result = await claimIdempotency('loc-1', 'existing-key', 'pos.createSale');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('pos.createSale.duplicateRequest');
      expect(result.error.details?.cachedResponse).toEqual({ saleId: '123' });
    }
  });

  it('fails with in progress error if key is claimed but not finished', async () => {
    selectRows = [{ id: 'idem-1', responseStatus: 102 }];
    const result = await claimIdempotency('loc-1', 'existing-key', 'pos.createSale');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('pos.createSale.duplicateRequest');
    }
  });

  it('allows claiming if previous attempt resulted in 500 error', async () => {
    selectRows = [{ id: 'idem-1', responseStatus: 500, responseBody: { error: 'server_error' } }];
    const result = await claimIdempotency('loc-1', 'error-key', 'pos.createSale');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('idem-1');
    }
  });

  it('saves idempotency records successfully', async () => {
    const tx = {
      insert: () => ({
        values: (val: any) => {
          inserts.push(val);
          return {
            onConflictDoUpdate: () => Promise.resolve()
          };
        }
      })
    };
    await saveIdempotency(tx, 'loc-1', 'idem-1', 200, { saleId: '123' });
    expect(inserts.length).toBe(1);
    expect(inserts[0].responseStatus).toBe(200);
    expect(inserts[0].responseBody).toEqual({ saleId: '123' });
  });

  it('releases idempotency claims successfully', async () => {
    await releaseIdempotencyClaim('idem-1', 400, { error: 'failed' });
    expect(updates.length).toBe(1);
    expect(updates[0].responseStatus).toBe(400);
    expect(updates[0].responseBody).toEqual({ error: 'failed' });
  });
});
