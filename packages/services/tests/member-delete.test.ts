/**
 * Member account deletion (UU PDP / E23) — T-0173 regression.
 *
 * Covers:
 *  - returns notFound when the partner row is absent.
 *  - updates partners with anonymised values, deletes credentials,
 *    revokes every session.
 *  - audit row written with `entityType='member'`, `action='delete'`,
 *    and **no raw PII** in the before/after payload.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let selectQueue: unknown[][] = [];
const inserts: Array<{ table: string; values: unknown }> = [];
const updates: Array<{ set: unknown }> = [];
let deleteCount = 0;

function nextSelectRows(): unknown[] {
  return selectQueue.shift() ?? [];
}

function tableName(table: unknown): string {
  return String(
    (table as { _: { name?: string } })?._?.name ??
      (table as { name?: string })?.name ??
      'unknown',
  );
}

vi.mock('@erp/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(nextSelectRows()),
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        inserts.push({ table: tableName(table), values });
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: (set: unknown) => {
        updates.push({ set });
        return { where: () => Promise.resolve() };
      },
    }),
    delete: () => ({
      where: () => {
        deleteCount += 1;
        return Promise.resolve();
      },
    }),
  },
}));

// hashMemberPassword cost-12 would dominate the test budget; not used
// in delete path but mocked defensively.
vi.mock('../src/member/password', () => ({
  hashMemberPassword: vi.fn(async (p: string) => `hash:${p}`),
  verifyMemberPassword: vi.fn(async () => true),
}));

import { deleteMyMember } from '../src/member';

const ctx = {
  userId: 'member-1',
  tenantId: 'tenant-1',
  locationId: '',
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent',
};

beforeEach(() => {
  selectQueue = [];
  inserts.length = 0;
  updates.length = 0;
  deleteCount = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deleteMyMember', () => {
  it('returns notFound when partner row is missing', async () => {
    selectQueue = [[]];
    const result = await deleteMyMember({ memberId: 'member-1' }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toContain('notFound');
    }
    expect(updates).toHaveLength(0);
    expect(deleteCount).toBe(0);
  });

  it('anonymises the partner row + revokes credentials + sessions', async () => {
    selectQueue = [[{ id: 'member-1', isActive: true, isMember: true }]];

    const result = await deleteMyMember(
      { memberId: 'member-1', reason: 'ganti nomor telepon' },
      ctx,
    );
    expect(result.ok).toBe(true);

    // The partner row is updated with anonymised values
    const partnerUpdate = updates.find(
      (u) =>
        typeof u.set === 'object' &&
        u.set !== null &&
        (u.set as { name?: string }).name === '__deleted__',
    );
    expect(partnerUpdate).toBeDefined();
    if (partnerUpdate) {
      const set = partnerUpdate.set as Record<string, unknown>;
      expect(set.isActive).toBe(false);
      expect(set.isMember).toBe(false);
      expect(set.phone).toBeNull();
      expect(set.address).toBeNull();
      expect(set.deletedAt).toBeInstanceOf(Date);
    }

    // Credentials + sessions hard-deleted (2 delete calls)
    expect(deleteCount).toBe(2);

    // Audit row written with no raw PII in before/after.
    const auditInsert = inserts.find(
      (i) =>
        typeof i.values === 'object' &&
        i.values !== null &&
        (i.values as { entityType?: string }).entityType === 'member' &&
        (i.values as { action?: string }).action === 'delete',
    );
    expect(auditInsert).toBeDefined();
    if (auditInsert) {
      const values = auditInsert.values as {
        before: unknown;
        after: Record<string, unknown>;
      };
      expect(values.before).toBeNull();
      expect(values.after.anonymised).toBe(true);
      expect(values.after.reason).toBe('ganti nomor telepon');
      // Sanity: no obvious PII keys
      const after = values.after;
      expect(after).not.toHaveProperty('name');
      expect(after).not.toHaveProperty('email');
      expect(after).not.toHaveProperty('phone');
    }
  });

  it('rejects empty memberId', async () => {
    const result = await deleteMyMember({ memberId: '' }, ctx);
    expect(result.ok).toBe(false);
  });
});
