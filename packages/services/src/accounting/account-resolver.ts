/**
 * accounting/account-resolver.ts — Shared helper for resolving COA codes to UUIDs.
 *
 * Background: many auto-journal call sites used to pass code strings
 * (`'1-1210'`, `'6-1110'`, etc.) directly into `createJournal()` as
 * `accountId`. `createJournal` validates `accountId` against `accounts.id`
 * (UUID), so those calls silently failed with `accountNotFound`.
 *
 * This module gives callers a single helper to resolve code → UUID,
 * keeping the literal COA codes as named constants where they live
 * today. A future ADR will move those constants into an
 * `accounting_settings` table so they're editable from the UI.
 */
import { db } from '@erp/db';
import { accounts } from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import { and, eq, inArray } from 'drizzle-orm';

/**
 * Resolve a single COA code to its `accounts.id` UUID for a tenant.
 * Returns null when the code is not found.
 */
export async function resolveAccountIdByCode(
  tenantId: string,
  code: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, code)))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Resolve many codes at once. Returns a Map keyed by code; missing
 * codes are absent from the map.
 */
export async function resolveAccountIdsByCodes(
  tenantId: string,
  codes: readonly string[],
): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map();
  const rows = await db
    .select({ id: accounts.id, code: accounts.code })
    .from(accounts)
    .where(and(eq(accounts.tenantId, tenantId), inArray(accounts.code, codes)));
  return new Map(rows.map((r) => [r.code, r.id]));
}

/**
 * Require a code to resolve, returning a Result. Use this at journal
 * call sites that previously trusted the literal code as `accountId`.
 */
export async function requireAccountIdByCode(
  tenantId: string,
  code: string,
  context = 'accounting.account.resolveFailed',
): Promise<Result<string>> {
  const id = await resolveAccountIdByCode(tenantId, code);
  if (!id) return err(AppError.notFound(context, { code }));
  return ok(id);
}
