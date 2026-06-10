/**
 * Custom Fields Service — SD §9.9, §17
 *
 * CRUD for field definitions + typed value management per entity.
 * Value validation respects data_type (string/number/boolean/date/enum/reference).
 * No EAV for core business data — this is for metadata only.
 */

import { db } from '@erp/db';
import { customFieldDefinitions, customFieldValues } from '@erp/db/schema/customfield';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, isNull, like, or, sql } from 'drizzle-orm';
import safeRegex from 'safe-regex';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

// ─── Data type enum ──────────────────────────────────────────────────────────

export const DATA_TYPES = ['string', 'number', 'boolean', 'date', 'enum', 'reference'] as const;
export type DataType = (typeof DATA_TYPES)[number];

// ─── Input schemas (inline Zod-lite) ─────────────────────────────────────

function parseValue(value: unknown, dataType: DataType): { valid: boolean; error?: string } {
  if (value === null || value === undefined) return { valid: true };

  switch (dataType) {
    case 'string':
      return typeof value === 'string'
        ? { valid: true }
        : { valid: false, error: 'Expected string' };
    case 'number':
      return typeof value === 'number'
        ? { valid: true }
        : { valid: false, error: 'Expected number' };
    case 'boolean':
      return typeof value === 'boolean'
        ? { valid: true }
        : { valid: false, error: 'Expected boolean' };
    case 'date':
      return !isNaN(Date.parse(String(value)))
        ? { valid: true }
        : { valid: false, error: 'Expected ISO date string' };
    case 'enum':
      return { valid: true }; // validated against enumOptions at service level
    case 'reference':
      return typeof value === 'string'
        ? { valid: true }
        : { valid: false, error: 'Expected reference string ID' };
    default:
      return { valid: false, error: `Unknown data type: ${dataType}` };
  }
}

// ─── Definitions ────────────────────────────────────────────────────────────

/**
 * Create a custom field definition.
 */
export async function createDefinition(
  input: {
    entityType: string;
    key: string;
    name: Record<string, string>; // LocaleString
    dataType: DataType;
    enumOptions?: Array<{ value: string; label: string }>;
    refEntityType?: string;
    isRequired?: boolean;
    validationRegex?: string;
    isIndexed?: boolean;
    displayOrder?: number;
  },
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'settings.manage', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (!DATA_TYPES.includes(input.dataType as DataType)) {
    return err(AppError.validation('customfield.invalidDataType', { dataType: input.dataType }));
  }
  if (!/^[a-z][a-z0-9_]*$/.test(input.key)) {
    return err(AppError.validation('customfield.invalidKey', { key: input.key }));
  }
  if (input.validationRegex && !safeRegex(input.validationRegex)) {
    return err(AppError.validation('customfield.unsafeRegex', { pattern: input.validationRegex }));
  }

  try {
    // Check duplicate key per entity type
    const existing = await db
      .select({ id: customFieldDefinitions.id })
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.tenantId, ctx.tenantId),
          eq(customFieldDefinitions.entityType, input.entityType),
          eq(customFieldDefinitions.key, input.key),
          isNull(customFieldDefinitions.deletedAt),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return err(
        AppError.conflict('customfield.duplicateKey', {
          key: input.key,
          entityType: input.entityType,
        }),
      );
    }

    const id = crypto.randomUUID();
    await db.insert(customFieldDefinitions).values({
      id,
      tenantId: ctx.tenantId,
      entityType: input.entityType,
      key: input.key,
      name: input.name as never,
      dataType: input.dataType,
      enumOptions: input.enumOptions ? (input.enumOptions as never) : null,
      refEntityType: input.refEntityType ?? null,
      isRequired: input.isRequired ?? false,
      validationRegex: input.validationRegex ?? null,
      isIndexed: input.isIndexed ?? false,
      displayOrder: input.displayOrder ?? 0,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    return ok({ id });
  } catch (e) {
    return err(AppError.internal('customfield.createDefinition.failed', e));
  }
}

/**
 * List custom field definitions for an entity type.
 */
export async function listDefinitions(
  entityType: string,
  ctx: AuditContext,
): Promise<Result<Record<string, unknown>[]>> {
  try {
    const rows = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.tenantId, ctx.tenantId),
          eq(customFieldDefinitions.entityType, entityType),
          isNull(customFieldDefinitions.deletedAt),
        ),
      )
      .orderBy(customFieldDefinitions.displayOrder);

    return ok(rows as Record<string, unknown>[]);
  } catch (e) {
    return err(AppError.internal('customfield.listDefinitions.failed', e));
  }
}

/**
 * Update a custom field definition.
 */
export async function updateDefinition(
  input: {
    id: string;
    name?: Record<string, string>;
    enumOptions?: Array<{ value: string; label: string }>;
    isRequired?: boolean;
    validationRegex?: string;
    isIndexed?: boolean;
    displayOrder?: number;
  },
  ctx: AuditContext,
): Promise<Result<void>> {
  const permCheck = await requirePermission(ctx.userId, 'settings.manage', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (input.validationRegex && !safeRegex(input.validationRegex)) {
    return err(AppError.validation('customfield.unsafeRegex', { pattern: input.validationRegex }));
  }

  try {
    const existing = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.id, input.id),
          eq(customFieldDefinitions.tenantId, ctx.tenantId),
          isNull(customFieldDefinitions.deletedAt),
        ),
      )
      .limit(1);

    if (!existing[0])
      return err(AppError.notFound('customfield.definitionNotFound', { id: input.id }));

    await db
      .update(customFieldDefinitions)
      .set({
        name: input.name ? (input.name as never) : existing[0].name,
        enumOptions:
          input.enumOptions !== undefined ? (input.enumOptions as never) : existing[0].enumOptions,
        isRequired: input.isRequired ?? existing[0].isRequired,
        validationRegex: input.validationRegex ?? existing[0].validationRegex,
        isIndexed: input.isIndexed ?? existing[0].isIndexed,
        displayOrder: input.displayOrder ?? existing[0].displayOrder,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customFieldDefinitions.id, input.id),
          eq(customFieldDefinitions.tenantId, ctx.tenantId),
        ),
      );

    return ok(undefined);
  } catch (e) {
    return err(AppError.internal('customfield.updateDefinition.failed', e));
  }
}

/**
 * Delete a custom field definition (also deletes all values).
 */
export async function deleteDefinition(id: string, ctx: AuditContext): Promise<Result<void>> {
  const permCheck = await requirePermission(ctx.userId, 'settings.manage', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const existing = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.id, id),
          eq(customFieldDefinitions.tenantId, ctx.tenantId),
          isNull(customFieldDefinitions.deletedAt),
        ),
      )
      .limit(1);

    if (!existing[0]) return err(AppError.notFound('customfield.definitionNotFound', { id }));

    const deletedAt = new Date();
    await db
      .update(customFieldValues)
      .set({ deletedAt, updatedBy: ctx.userId, updatedAt: deletedAt })
      .where(eq(customFieldValues.definitionId, id));

    await db
      .update(customFieldDefinitions)
      .set({ deletedAt, updatedBy: ctx.userId, updatedAt: deletedAt })
      .where(
        and(eq(customFieldDefinitions.id, id), eq(customFieldDefinitions.tenantId, ctx.tenantId)),
      );

    await auditRecord({
      action: 'delete',
      entityType: 'custom_field_definition',
      entityId: id,
      before: {
        entityType: existing[0].entityType,
        key: existing[0].key,
        dataType: existing[0].dataType,
      },
      after: { deletedAt: deletedAt.toISOString() },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    return ok(undefined);
  } catch (e) {
    return err(AppError.internal('customfield.deleteDefinition.failed', e));
  }
}

// ─── Values ────────────────────────────────────────────────────────────────

/**
 * Set a custom field value on an entity.
 * Validates value against the definition's data_type + regex.
 */
export async function setValue(
  input: {
    entityId: string;
    definitionId: string;
    value: unknown;
  },
  ctx: AuditContext,
): Promise<Result<void>> {
  try {
    const def = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.id, input.definitionId),
          eq(customFieldDefinitions.tenantId, ctx.tenantId),
          isNull(customFieldDefinitions.deletedAt),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!def)
      return err(AppError.notFound('customfield.definitionNotFound', { id: input.definitionId }));

    const dataType = def.dataType as DataType;
    const validation = parseValue(input.value, dataType);
    if (!validation.valid) {
      return err(AppError.validation('customfield.invalidValue', { error: validation.error }));
    }

    // Validate enum options
    if (dataType === 'enum' && def.enumOptions && input.value !== null) {
      const validValues = (def.enumOptions as Array<{ value: string }>).map((o) => o.value);
      if (!validValues.includes(String(input.value))) {
        return err(
          AppError.validation('customfield.invalidEnumValue', {
            value: input.value,
            allowed: validValues,
          }),
        );
      }
    }

    // Validate regex
    if (dataType === 'string' && def.validationRegex && input.value !== null) {
      try {
        const re = new RegExp(def.validationRegex as string);
        if (!re.test(String(input.value))) {
          return err(
            AppError.validation('customfield.regexMismatch', { pattern: def.validationRegex }),
          );
        }
      } catch {
        /* invalid regex in definition — skip */
      }
    }

    // Upsert
    const existing = await db
      .select({ id: customFieldValues.definitionId })
      .from(customFieldValues)
      .where(
        and(
          eq(customFieldValues.definitionId, input.definitionId),
          eq(customFieldValues.entityId, input.entityId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(customFieldValues)
        .set({
          value: input.value as never,
          deletedAt: null,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customFieldValues.definitionId, input.definitionId),
            eq(customFieldValues.entityId, input.entityId),
          ),
        );
    } else {
      await db.insert(customFieldValues).values({
        definitionId: input.definitionId,
        entityId: input.entityId,
        value: input.value as never,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    return ok(undefined);
  } catch (e) {
    return err(AppError.internal('customfield.setValue.failed', e));
  }
}

/**
 * Get a single custom field value.
 */
export async function getValue(entityId: string, definitionId: string): Promise<Result<unknown>> {
  try {
    const rows = await db
      .select({ value: customFieldValues.value })
      .from(customFieldValues)
      .where(
        and(
          eq(customFieldValues.definitionId, definitionId),
          eq(customFieldValues.entityId, entityId),
        ),
      )
      .limit(1);

    return ok(rows[0]?.value ?? null);
  } catch (e) {
    return err(AppError.internal('customfield.getValue.failed', e));
  }
}

/**
 * Get all custom field values for an entity.
 * Returns a map of definitionId → value.
 */
export async function getValuesByEntity(
  entityId: string,
  entityType: string,
  ctx: AuditContext,
): Promise<Result<Record<string, unknown>>> {
  try {
    const defs = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.tenantId, ctx.tenantId),
          eq(customFieldDefinitions.entityType, entityType),
          isNull(customFieldDefinitions.deletedAt),
        ),
      )
      .orderBy(customFieldDefinitions.displayOrder);

    const defIds = defs.map((d) => d.id);
    if (defIds.length === 0) return ok({});

    const values = await db
      .select()
      .from(customFieldValues)
      .where(
        and(
          eq(customFieldValues.entityId, entityId),
          isNull(customFieldValues.deletedAt),
          sql`${customFieldValues.definitionId} IN (${sql.join(
            defIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      );

    const map: Record<string, unknown> = {};
    for (const v of values) {
      map[v.definitionId] = v.value;
    }

    return ok(map);
  } catch (e) {
    return err(AppError.internal('customfield.getValuesByEntity.failed', e));
  }
}

/**
 * Search entities by custom field value.
 * Supports operators: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains'
 */
export async function search(
  input: {
    entityType: string;
    definitionId: string;
    op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
    value: unknown;
    limit?: number;
  },
  ctx: AuditContext,
): Promise<Result<{ entityIds: string[] }>> {
  try {
    const def = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.id, input.definitionId),
          eq(customFieldDefinitions.tenantId, ctx.tenantId),
          eq(customFieldDefinitions.entityType, input.entityType),
          isNull(customFieldDefinitions.deletedAt),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!def)
      return err(AppError.notFound('customfield.definitionNotFound', { id: input.definitionId }));

    // Build WHERE clause based on operator
    let whereClause;
    const val = input.value;

    switch (input.op) {
      case 'eq':
        whereClause = sql`${customFieldValues.value} = ${JSON.stringify(val)}::jsonb`;
        break;
      case 'ne':
        whereClause = sql`${customFieldValues.value} != ${JSON.stringify(val)}::jsonb`;
        break;
      case 'gt': {
        const numericVal = Number(val);
        if (!Number.isFinite(numericVal)) {
          return err(AppError.validation('customfield.numericOperatorRequiresNumber'));
        }
        whereClause = sql`(${customFieldValues.value} #>> '{}')::numeric > ${numericVal}`;
        break;
      }
      case 'gte': {
        const numericVal = Number(val);
        if (!Number.isFinite(numericVal)) {
          return err(AppError.validation('customfield.numericOperatorRequiresNumber'));
        }
        whereClause = sql`(${customFieldValues.value} #>> '{}')::numeric >= ${numericVal}`;
        break;
      }
      case 'lt': {
        const numericVal = Number(val);
        if (!Number.isFinite(numericVal)) {
          return err(AppError.validation('customfield.numericOperatorRequiresNumber'));
        }
        whereClause = sql`(${customFieldValues.value} #>> '{}')::numeric < ${numericVal}`;
        break;
      }
      case 'lte': {
        const numericVal = Number(val);
        if (!Number.isFinite(numericVal)) {
          return err(AppError.validation('customfield.numericOperatorRequiresNumber'));
        }
        whereClause = sql`(${customFieldValues.value} #>> '{}')::numeric <= ${numericVal}`;
        break;
      }
      case 'contains':
        whereClause = sql`(${customFieldValues.value} #>> '{}') ILIKE ${`%${String(val)}%`}`;
        break;
      case 'in':
        if (Array.isArray(val)) {
          whereClause =
            val.length === 0
              ? sql`false`
              : sql`${customFieldValues.value} IN (${sql.join(
                  val.map((item) => sql`${JSON.stringify(item)}::jsonb`),
                  sql`, `,
                )})`;
        } else {
          return err(AppError.validation('customfield.inOperatorRequiresArray'));
        }
        break;
      default:
        return err(AppError.validation('customfield.unknownOperator', { op: input.op }));
    }

    const rows = await db
      .select({ entityId: customFieldValues.entityId })
      .from(customFieldValues)
      .innerJoin(
        customFieldDefinitions,
        eq(customFieldValues.definitionId, customFieldDefinitions.id),
      )
      .where(
        and(
          eq(customFieldDefinitions.tenantId, ctx.tenantId),
          eq(customFieldDefinitions.entityType, input.entityType),
          isNull(customFieldDefinitions.deletedAt),
          isNull(customFieldValues.deletedAt),
          eq(customFieldValues.definitionId, input.definitionId),
          whereClause,
        ),
      )
      .limit(input.limit ?? 50);

    return ok({ entityIds: rows.map((r) => r.entityId) });
  } catch (e) {
    return err(AppError.internal('customfield.search.failed', e));
  }
}
