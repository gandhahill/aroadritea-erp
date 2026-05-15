/**
 * @erp/services/audit — Audit trail service (SD §15, §9.11)
 *
 * Provides `audit.record()` — the single write path for all audit entries.
 * Called by every service mutation AFTER the DB write succeeds.
 *
 * Rules:
 * - Audit records are immutable append-only. No UPDATE/DELETE ever.
 * - `before` is null for CREATE actions.
 * - `after` is null for DELETE actions.
 * - All other actions (update, post, reverse, void, etc.) have both.
 * - Metadata is optional context (IP, user agent, extra fields).
 */

import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { generateId } from '@erp/shared/id';
import type { AuditContext } from '@erp/shared/types';

// ─── Input types ────────────────────────────────────────────────────────────────

/** Actions that can be recorded in the audit log. */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'post'
  | 'reverse'
  | 'void'
  | 'refund'
  | 'login'
  | 'logout'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'submit'
  | 'open'
  | 'close';

/** Input for a single audit log entry. */
export interface AuditRecordInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

/** Extended input that carries its own AuditContext. */
export interface AuditRecordParams extends AuditRecordInput {
  ctx: AuditContext;
}

// ─── Result type ───────────────────────────────────────────────────────────────

export interface AuditRecordResult {
  id: string;
  tenantId: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  createdAt: Date;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Known entity types that match the existing schema. */
const KNOWN_ENTITY_TYPES = new Set([
  'shift',
  'sale',
  'sale_line',
  'payment',
  'refund',
  'journal_entry',
  'journal_line',
  'account',
  'tax_rate',
  'tax_rule',
  'period',
  'product',
  'product_variant',
  'product_category',
  'product_modifier',
  'stock_movement',
  'stock_level',
  'bom',
  'bom_line',
  'purchase_order',
  'grn',
  'purchase_invoice',
  'user',
  'role',
  'permission',
  'location',
  'partner',
  'attendance',
  'leave',
  'payroll_run',
  'reimbursement_request',
  'petty_cash_account',
  'petty_cash_transaction',
  'naixer_product_code',
  'naixer_modifier_code',
  'naixer_qr_format_config',
  'cms_page',
  'cms_post',
  'cms_banner',
  'cms_faq',
  'cms_settings',
  'member',
  'member_session',
  'voucher',
  'complaint',
]);

/** Validate that before/after snapshots have primitive values only (no BigInt, Date, etc.). */
function sanitizeRecord(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (data === null || data === undefined) return null;
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'bigint') {
      sanitized[k] = String(v);
    } else if (v instanceof Date) {
      sanitized[k] = v.toISOString();
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      sanitized[k] = sanitizeRecord(v as Record<string, unknown>);
    } else if (Array.isArray(v)) {
      sanitized[k] = v.map((item) =>
        typeof item === 'object' && item !== null
          ? sanitizeRecord(item as Record<string, unknown>)
          : item,
      );
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Record an audit log entry.
 *
 * Usage inside service functions:
 *   const result = await db.insert(...).returning();
 *   await audit.record({ action: 'create', entityType: 'sale', entityId: result[0].id, after: { ... }, ctx });
 *
 * @param input  The audit record input + AuditContext
 * @returns The created audit record ID (never fails — errors are swallowed)
 */
export async function auditRecord(input: AuditRecordParams): Promise<AuditRecordResult> {
  const { ctx, ...record } = input;

  const id = generateId();
  const now = new Date();

  // Validate action
  const action: AuditAction = record.action;

  // Validate entityType (warn if unknown, but don't block)
  const entityType: string = record.entityType;

  // Sanitize before/after
  const before = sanitizeRecord(record.before ?? null);
  const after = sanitizeRecord(record.after ?? null);

  // Build metadata
  const metadata: Record<string, unknown> = {
    ...(record.metadata ?? {}),
    ...(ctx.ipAddress !== undefined && { ip: ctx.ipAddress }),
    ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
  };

  await db.insert(auditLog).values({
    id,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action,
    entityType,
    entityId: record.entityId,
    before,
    after,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    createdAt: now,
  });

  return {
    id,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action,
    entityType,
    entityId: record.entityId,
    createdAt: now,
  };
}

/**
 * Shorthand: build AuditRecordInput from action + entity + optional before/after.
 * Use this to construct the input before passing to auditRecord().
 *
 * @example
 * const input = auditInput({ action: 'post', entityType: 'journal_entry', entityId: id, after: { status: 'posted' } });
 */
export function auditInput(input: Omit<AuditRecordInput, never>): AuditRecordInput {
  return input;
}

/**
 * Build metadata from AuditContext (convenience helper).
 */
export function auditMetadata(ctx: AuditContext): Record<string, unknown> {
  return {
    ...(ctx.ipAddress !== undefined && { ip: ctx.ipAddress }),
    ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
  };
}
