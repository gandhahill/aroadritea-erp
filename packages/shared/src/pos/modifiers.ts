/**
 * Canonical modifier-selection shape for POS sales order lines (ADR-0019).
 *
 * Replaces two incompatible shapes that previously coexisted as dead code:
 * the `{ sugar?, ice?, toppings? }` object expected by kds-service, and the
 * `{ kind, optionId }[]` array expected by normalizeNaixerModifiers. Neither
 * was ever populated by a UI (Finding 1, T-0299), so no data migration is
 * needed — `salesOrderLines.modifierJson` is always empty in existing rows.
 */

export type ModifierGroupRole = 'sugar' | 'ice' | 'topping' | 'size' | 'cup' | 'other' | 'custom';

const MODIFIER_GROUP_ROLES: readonly ModifierGroupRole[] = [
  'sugar',
  'ice',
  'topping',
  'size',
  'cup',
  'other',
  'custom',
];

/** One modifier choice on a sales order line, frozen at order time. */
export interface ModifierSelection {
  groupId: string;
  groupRole: ModifierGroupRole;
  /** Localized group display name, snapshot at order time. */
  groupName: string;
  optionId: string;
  /** Localized option display name, snapshot at order time. */
  optionName: string;
  /** Bigint as string, snapshot at order time. */
  extraPrice: string;
}

export type ModifierJson = ModifierSelection[];

function isModifierSelection(value: unknown): value is ModifierSelection {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.groupId === 'string' &&
    typeof v.groupRole === 'string' &&
    (MODIFIER_GROUP_ROLES as string[]).includes(v.groupRole) &&
    typeof v.groupName === 'string' &&
    typeof v.optionId === 'string' &&
    typeof v.optionName === 'string' &&
    typeof v.extraPrice === 'string'
  );
}

/** Parses `modifierJson` from the DB (or any unknown value) into a safe array. */
export function parseModifierSelections(value: unknown): ModifierSelection[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isModifierSelection);
}

/** Groups selections by their group role, preserving array order within each bucket. */
export function groupModifierSelectionsByRole(
  selections: ModifierSelection[],
): Map<ModifierGroupRole, ModifierSelection[]> {
  const grouped = new Map<ModifierGroupRole, ModifierSelection[]>();
  for (const selection of selections) {
    const bucket = grouped.get(selection.groupRole);
    if (bucket) bucket.push(selection);
    else grouped.set(selection.groupRole, [selection]);
  }
  return grouped;
}

/** Sum of `extraPrice` across all selections, as a bigint. */
export function sumModifierExtraPrice(selections: ModifierSelection[]): bigint {
  return selections.reduce((total, s) => total + BigInt(s.extraPrice || '0'), 0n);
}
