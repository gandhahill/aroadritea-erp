/**
 * Locations Page - SD §22.2
 * Lists active store branches and offices from ERP location master data.
 */
import { db } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { and, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ locale: string }>;
}

type Locale = 'id' | 'en' | 'zh';
type LocalizedText = { id?: string; en?: string; zh?: string };

export const dynamic = 'force-dynamic';

export default async function LocationsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'locations' });
  const rows = await getPublicLocations(locale as Locale);

  return (
    <div className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-black text-brand-ink md:text-6xl">{t('title')}</h1>
          <p className="mt-4 text-base leading-7 text-brand-ink-2">{t('subtitle')}</p>
        </div>

        {rows.length === 0 ? (
          <p className="mt-10 rounded-[8px] border border-brand-red/10 bg-brand-cream-1 px-4 py-6 text-center text-sm text-brand-ink-3 shadow-soft">
            {t('empty')}
          </p>
        ) : (
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {rows.map((location) => (
              <article
                key={location.id}
                className="rounded-[8px] border border-brand-red/10 bg-brand-cream-1 p-6 shadow-soft"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-gold">
                      {location.type === 'store' ? t('store') : t('office')}
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-brand-red">{location.name}</h2>
                  </div>
                  <span className="rounded-full bg-brand-cream px-3 py-1 text-xs font-black text-brand-ink-3">
                    {location.code}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-brand-ink-2">{location.address}</p>
                <p className="mt-4 text-sm font-bold text-brand-ink">{t('defaultHours')}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function getPublicLocations(locale: Locale) {
  const rows = await db
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
      type: locations.type,
      address: locations.address,
    })
    .from(locations)
    .where(and(eq(locations.tenantId, 'default'), eq(locations.status, 'active')))
    .orderBy(locations.type, locations.code);

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: localized(row.name as LocalizedText, locale),
    type: row.type,
    address: row.address ?? '',
  }));
}

function localized(value: LocalizedText, locale: Locale): string {
  return value[locale] ?? value.id ?? value.en ?? value.zh ?? '';
}
