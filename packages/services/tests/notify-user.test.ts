/**
 * notify-user regression — T-0175.
 *
 * Verifies that:
 *  - notifyUser inserts a single user_notifications row and reports
 *    success even when SMTP is not configured (skipped email).
 *  - notifyUserByEmail resolves to a user by email and still notifies
 *    when the email argument is not present in the email_template.
 *  - When email_template is provided and SMTP is configured we attempt
 *    the send (covered by the mocked transport).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const inserts: Array<{ values: unknown }> = [];
let selectQueue: unknown[][] = [];

function nextSelectRows(): unknown[] {
  return selectQueue.shift() ?? [];
}

vi.mock('@erp/db', () => ({
  db: {
    insert: () => ({
      values: (values: unknown) => {
        inserts.push({ values });
        return Promise.resolve();
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(nextSelectRows()) }),
      }),
    }),
  },
  and: () => undefined,
  eq: () => undefined,
}));

const sendMock = vi.fn(async () => ({ ok: true }));
vi.mock('../src/notification/email-transport', () => ({
  sendTransactionalEmail: (...args: unknown[]) => sendMock(...(args as [])),
}));

import { notifyUser, notifyUserByEmail } from '../src/notification/notify-user';

beforeEach(() => {
  inserts.length = 0;
  selectQueue = [];
  sendMock.mockReset();
  sendMock.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('notifyUser', () => {
  it('inserts one user_notifications row and skips email when none requested', async () => {
    const result = await notifyUser({
      tenantId: 'tenant-1',
      userId: 'user-1',
      kind: 'shift',
      title: 'Shift baru',
      body: 'Tanggal 2026-05-26',
    });
    expect(result.ok).toBe(true);
    expect(inserts.length).toBe(1);
    const v = inserts[0]?.values as { kind: string; title: string; body: string };
    expect(v.kind).toBe('shift');
    expect(v.title).toBe('Shift baru');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends email when email_template is provided + user has email', async () => {
    selectQueue = [[{ email: 'lintang@aroadri.com', status: 'active' }]];
    const result = await notifyUser({
      tenantId: 'tenant-1',
      userId: 'user-1',
      kind: 'shift',
      title: 'Shift updated',
      email: {
        subject: '[Aroadri] shift',
        text: 'plain',
        html: '<p>html</p>',
      },
    });
    expect(result.ok).toBe(true);
    expect(result.emailOk).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('marks emailOk=false when user is inactive', async () => {
    selectQueue = [[{ email: 'left@aroadri.com', status: 'terminated' }]];
    const result = await notifyUser({
      tenantId: 'tenant-1',
      userId: 'user-1',
      kind: 'shift',
      title: 'x',
      email: { subject: 's', text: 't', html: '<p>h</p>' },
    });
    expect(result.ok).toBe(true);
    expect(result.emailOk).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('notifyUserByEmail', () => {
  it('resolves an existing user and forwards to notifyUser', async () => {
    // 1) findUser select returns the user, 2) inside notifyUser the
    // user re-lookup for email recipient.
    selectQueue = [[{ id: 'user-99', email: 'cashier@aroadri.com' }], [{ email: 'cashier@aroadri.com', status: 'active' }]];
    const result = await notifyUserByEmail({
      tenantId: 'tenant-1',
      email: 'cashier@aroadri.com',
      kind: 'shift',
      title: 'Hello',
      email_template: { subject: 's', text: 't', html: '<p>h</p>' },
    });
    expect(result.ok).toBe(true);
    expect(inserts.length).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to direct email when no user row exists', async () => {
    selectQueue = [[]];
    const result = await notifyUserByEmail({
      tenantId: 'tenant-1',
      email: 'unknown@aroadri.com',
      kind: 'shift',
      title: 'Hello',
      email_template: { subject: 's', text: 't', html: '<p>h</p>' },
    });
    expect(result.ok).toBe(true);
    expect(result.emailOk).toBe(true);
    expect(inserts.length).toBe(0); // no in-app row when no user matched
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
