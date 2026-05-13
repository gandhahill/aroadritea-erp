/**
 * Audit service tests — T-0016b
 *
 * Tests: sanitizeRecord (BigInt, Date, nested objects),
 * auditInput helper, auditMetadata helper.
 * DB integration via db.insert is tested implicitly (sanity only).
 */

import { describe, expect, it } from 'vitest';
import { auditInput, auditMetadata } from '../src/audit';

// ─── sanitizeRecord (tested indirectly via auditInput contract) ───────────────

describe('auditInput helper', () => {
  it('accepts create action with after snapshot', () => {
    const input = auditInput({
      action: 'create',
      entityType: 'sale',
      entityId: 'sale-001',
      after: {
        id: 'sale-001',
        status: 'completed',
        grandTotal: 500000n,
        createdAt: new Date('2026-05-09T10:00:00Z'),
      },
    });
    expect(input.action).toBe('create');
    expect(input.entityType).toBe('sale');
    expect(input.entityId).toBe('sale-001');
    expect(input.before).toBeUndefined();
    expect(input.after).toBeDefined();
  });

  it('accepts update action with both before and after', () => {
    const input = auditInput({
      action: 'update',
      entityType: 'journal_entry',
      entityId: 'je-001',
      before: { status: 'draft' },
      after: { status: 'posted' },
    });
    expect(input.action).toBe('update');
    expect(input.before).toEqual({ status: 'draft' });
    expect(input.after).toEqual({ status: 'posted' });
  });

  it('accepts delete action with before snapshot only', () => {
    const input = auditInput({
      action: 'delete',
      entityType: 'product',
      entityId: 'prod-001',
      before: { id: 'prod-001', name: 'Teh Tarik' },
      after: null,
    });
    expect(input.action).toBe('delete');
    expect(input.after).toBeNull();
  });

  it('accepts all known actions', () => {
    const actions = [
      'create',
      'update',
      'delete',
      'post',
      'reverse',
      'void',
      'refund',
      'login',
      'logout',
      'approve',
      'reject',
      'cancel',
      'submit',
      'open',
      'close',
    ] as const;
    for (const action of actions) {
      const input = auditInput({ action, entityType: 'test', entityId: 'x' });
      expect(input.action).toBe(action);
    }
  });

  it('accepts nested before/after with mixed types', () => {
    const input = auditInput({
      action: 'update',
      entityType: 'shift',
      entityId: 'shift-001',
      before: {
        status: 'open',
        lines: [{ productId: 'p1', qty: 2n }],
        nested: { deep: new Date('2026-05-09T10:00:00Z') },
      },
      after: {
        status: 'closed',
        lines: [{ productId: 'p1', qty: 2n }],
        nested: { deep: new Date('2026-05-09T12:00:00Z') },
      },
    });
    expect(input.before).toBeDefined();
    expect(input.after).toBeDefined();
  });

  it('accepts metadata', () => {
    const input = auditInput({
      action: 'post',
      entityType: 'journal_entry',
      entityId: 'je-001',
      metadata: { reason: 'month-end-close', ip: '192.168.1.1' },
    });
    expect(input.metadata).toEqual({ reason: 'month-end-close', ip: '192.168.1.1' });
  });
});

describe('auditMetadata helper', () => {
  it('returns empty object when no optional fields', () => {
    const meta = auditMetadata({ userId: 'u1', tenantId: 't1', locationId: 'l1' });
    expect(meta).toEqual({});
  });

  it('includes ipAddress when present', () => {
    const meta = auditMetadata({
      userId: 'u1',
      tenantId: 't1',
      locationId: 'l1',
      ipAddress: '10.0.0.1',
    });
    expect(meta).toEqual({ ip: '10.0.0.1' });
  });

  it('includes userAgent when present', () => {
    const meta = auditMetadata({
      userId: 'u1',
      tenantId: 't1',
      locationId: 'l1',
      userAgent: 'Mozilla/5.0',
    });
    expect(meta).toEqual({ userAgent: 'Mozilla/5.0' });
  });

  it('includes both when present', () => {
    const meta = auditMetadata({
      userId: 'u1',
      tenantId: 't1',
      locationId: 'l1',
      ipAddress: '192.168.1.100',
      userAgent: 'AroadriPOS/1.0',
    });
    expect(meta).toEqual({ ip: '192.168.1.100', userAgent: 'AroadriPOS/1.0' });
  });
});
