import { and, asc, db, eq, locations } from '@erp/db';

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
  const conditions = [eq(locations.tenantId, tenantId), eq(locations.status, 'active')];
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

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    label: localize(row.name as LocalizedText, locale),
    type: row.type,
    address: row.address,
  }));
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

function localize(value: LocalizedText, locale: Locale): string {
  return value[locale] ?? value.id ?? value.en ?? value.zh ?? '';
}
