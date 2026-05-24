import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let selectResults: unknown[][] = [];
let selectIndex = 0;
const insertValues: unknown[] = [];
const updateSets: unknown[] = [];
let deleteCount = 0;

vi.mock('@erp/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectResults[selectIndex++] ?? []),
        }),
      }),
    }),
    insert: () => ({
      values: (value: unknown) => {
        insertValues.push(value);
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: (value: unknown) => {
        updateSets.push(value);
        return {
          where: () => Promise.resolve(),
        };
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

// Mock bcrypt-backed password helpers so the test does not pay the cost-12
// hashing penalty (which can exceed the default 5 s vitest timeout on slower
// CI/dev machines and was flaking this regression).
vi.mock('../src/member/password', () => ({
  hashMemberPassword: vi.fn(async (password: string) => `hash:${password}`),
  verifyMemberPassword: vi.fn(async () => true),
}));

import { completeMemberPasswordReset, requestMemberPasswordReset } from '../src/member/index';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('member password reset', () => {
  beforeEach(() => {
    selectResults = [];
    selectIndex = 0;
    insertValues.length = 0;
    updateSets.length = 0;
    deleteCount = 0;
    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  it('creates a single-use reset token only for an active member with credentials', async () => {
    selectResults = [[{ id: 'member-001', isActive: true, isMember: true }], [{ id: 'cred-001' }]];

    const result = await requestMemberPasswordReset({
      email: 'Member@Example.com',
      locale: 'id',
    });

    expect(result.ok).toBe(true);
    const resetToken = insertValues.find(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        (value as { purpose?: string }).purpose === 'reset',
    ) as { recipient: string; token: string; codeHash: string; tokenExpiresAt: Date } | undefined;

    expect(resetToken).toBeDefined();
    expect(resetToken?.recipient).toBe('member@example.com');
    expect(resetToken?.token).toHaveLength(64);
    expect(resetToken?.codeHash).toBe(hashToken(resetToken?.token ?? ''));
    expect(updateSets).toHaveLength(1);
  });

  it('does not reveal whether an email is registered', async () => {
    selectResults = [[]];

    const result = await requestMemberPasswordReset({
      email: 'unknown@example.com',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    expect(insertValues).toHaveLength(1);
    expect(
      insertValues.some(
        (value) =>
          typeof value === 'object' &&
          value !== null &&
          (value as { purpose?: string }).purpose === 'reset',
      ),
    ).toBe(false);
  });

  it('updates the password, revokes sessions, and consumes the reset token', async () => {
    const token = 'b'.repeat(64);
    selectResults = [
      [
        {
          id: 'otp-001',
          purpose: 'reset',
          recipient: 'member@example.com',
          token,
          codeHash: hashToken(token),
          consumedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          tokenExpiresAt: new Date(Date.now() + 60_000),
        },
      ],
      [{ id: 'member-001', isActive: true, isMember: true }],
      [{ id: 'cred-001' }],
    ];

    const result = await completeMemberPasswordReset({
      token,
      password: 'new-password-123',
    });

    expect(result.ok).toBe(true);
    expect(
      updateSets.some((set) => typeof set === 'object' && set !== null && 'passwordHash' in set),
    ).toBe(true);
    expect(deleteCount).toBe(1);
    expect(
      updateSets.some((set) => typeof set === 'object' && set !== null && 'consumedAt' in set),
    ).toBe(true);
  });
});
