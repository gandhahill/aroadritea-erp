import { and, asc, db, eq, isNull, locations } from '@erp/db';

type Locale = 'id' | 'en' | 'zh';
type LocalizedText = Partial<Record<Locale, string>>;

export interface LocationOption {
  id: string;
  code: string;
  label: string;
  type: string;
  address: string | null;
}

export async function getActiveLocationOptions({
  tenantId,
  locale = 'id',
  type,
}: {
  tenantId: string;
  locale?: Locale;
  type?: 'store' | 'office' | 'warehouse';
}): Promise<LocationOption[]> {
  const conditions = [
    eq(locations.tenantId, tenantId),
    eq(locations.status, 'active'),
    isNull(locations.deletedAt),
  ];
  if (type) conditions.push(eq(locations.type, type));

  const rows = await db
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
      type: locations.type,
      address: locations.address,
    })
    .from(locations)
    .where(and(...conditions))
    .orderBy(asc(locations.code));

  return rows.map((row) => {
    const localized = localize(row.name as LocalizedText | null, locale);
    // Compose `Code · Name` so the dropdown is unambiguous when two
    // outlets share a code/name prefix. Falls back to code-only or the
    // raw UUID only if both fields are empty (defensive — should never
    // happen for a valid seeded outlet).
    const label = localized && row.code
      ? `${row.code} · ${localized}`
      : localized || row.code || row.id;
    return {
      id: row.id,
      code: row.code,
      label,
      type: row.type,
      address: row.address,
    };
  });
}

export function resolveDefaultLocationId(
  options: LocationOption[],
  requestedLocationId?: string,
  sessionLocationId?: string,
): string {
  const ids = new Set(options.map((option) => option.id));
  if (requestedLocationId && ids.has(requestedLocationId)) return requestedLocationId;
  if (sessionLocationId && ids.has(sessionLocationId)) return sessionLocationId;
  return options[0]?.id ?? '';
}

function localize(value: LocalizedText | null | undefined, locale: Locale): string {
  if (!value) return '';
  return value[locale] ?? value.id ?? value.en ?? value.zh ?? '';
}
