/**
 * Locations Page - SD §22.2
 * Lists active public store branches from ERP location master data.
 */
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ locale: string }>;
}

type Locale = 'id' | 'en' | 'zh';
type LocalizedText = { id?: string; en?: string; zh?: string };

export const dynamic = 'force-dynamic';

// Map provider choice: Google Maps is blocked in mainland China, so we never
// link to it. OpenStreetMap is universally reachable; AMap (高德) is preferred
// for zh locale because it's the native experience for Chinese visitors.
const PUBLIC_STORE_FALLBACKS = [
  {
    id: 'fallback-mli',
    code: 'MLI',
    name: {
      id: 'Aroadri Tea Malioboro Mall',
      en: 'Aroadri Tea Malioboro Mall',
      zh: 'Aroadri Tea Malioboro Mall',
    },
    type: 'store',
    address:
      'Malioboro Mall, Jl. Mataram No. 31, Suryatmajan, Danurejan, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55213',
    openingHours: { monday: '10:00 - 22:00', tuesday: '10:00 - 22:00', wednesday: '10:00 - 22:00', thursday: '10:00 - 22:00', friday: '10:00 - 22:00', saturday: '10:00 - 22:00', sunday: '10:00 - 22:00' },
    deliveryLink: 'https://gofood.co.id/yogyakarta/restaurant/aroadri-tea-malioboro-mall',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3953.0312015091724!2d110.36440537494412!3d-7.791783992226279!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e7a574218dc65b5%3A0x6b44ab50fcdab44!2sMalioboro%20Mall!5e0!3m2!1sen!2sid!4v1700000000000!5m2!1sen!2sid',
  },
  {
    id: 'fallback-plz',
    code: 'PLZ',
    name: {
      id: 'Aroadri Tea Plaza Malioboro',
      en: 'Aroadri Tea Plaza Malioboro',
      zh: 'Aroadri Tea Plaza Malioboro',
    },
    type: 'store',
    address:
      'Plaza Malioboro, Jl. Malioboro No. 52-58, Suryatmajan, Danurejan, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55213',
    openingHours: { monday: '10:00 - 22:00', tuesday: '10:00 - 22:00', wednesday: '10:00 - 22:00', thursday: '10:00 - 22:00', friday: '10:00 - 22:00', saturday: '10:00 - 22:00', sunday: '10:00 - 22:00' },
    deliveryLink: 'https://gofood.co.id/yogyakarta/restaurant/aroadri-tea-plaza-malioboro',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3953.0312015091724!2d110.36440537494412!3d-7.791783992226279!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e7a574218dc65b5%3A0x6b44ab50fcdab44!2sMalioboro%20Mall!5e0!3m2!1sen!2sid!4v1700000000000!5m2!1sen!2sid',
  },
] as const;

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
                {Boolean(location.openingHours) && (
                  <ul className="mt-2 text-sm text-brand-ink-2 space-y-1">
                    {Object.entries(location.openingHours as Record<string, string>).map(([day, hours]) => (
                      <li key={day} className="flex justify-between">
                        <span className="capitalize">{day}</span>
                        <span>{hours}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold">
                  {location.deliveryLink && (
                    <a
                      href={location.deliveryLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-brand-gold px-4 py-2 text-brand-ink transition-brand hover:bg-brand-gold/80"
                    >
                      {t('orderDelivery') || 'Order Delivery'}
                    </a>
                  )}
                  {location.mapUrl && !location.mapEmbedUrl && (
                    <a
                      href={location.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-brand-red px-4 py-2 text-brand-cream transition-brand hover:bg-brand-red-dark"
                    >
                      {t('map')}
                    </a>
                  )}
                </div>
                {location.mapEmbedUrl && (
                  <div className="mt-6 aspect-video w-full overflow-hidden rounded-lg">
                    <iframe
                      src={location.mapEmbedUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function getPublicLocations(locale: Locale) {
  if (!process.env.DATABASE_URL) return fallbackLocations(locale);

  let rows: Array<{
    id: string;
    code: string;
    name: unknown;
    type: string;
    address: string | null;
    openingHours: unknown;
    deliveryLink: string | null;
    mapEmbedUrl: string | null;
  }>;

  try {
    const [{ db }, { locations }, { and, eq }] = await Promise.all([
      import('@erp/db'),
      import('@erp/db/schema/auth'),
      import('drizzle-orm'),
    ]);

    rows = await db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
        type: locations.type,
        address: locations.address,
        openingHours: locations.openingHours,
        deliveryLink: locations.deliveryLink,
        mapEmbedUrl: locations.mapEmbedUrl,
      })
      .from(locations)
      .where(
        and(
          eq(locations.tenantId, 'default'),
          eq(locations.status, 'active'),
          eq(locations.type, 'store'),
        ),
      )
      .orderBy(locations.type, locations.code);
  } catch {
    return fallbackLocations(locale);
  }

  if (rows.length === 0) return fallbackLocations(locale);

  return rows.map((row) => {
    const address = normalizeAddress(row.code, row.address);
    return {
      id: row.id,
      code: row.code,
      name: localized(row.name as LocalizedText, locale),
      type: row.type,
      address,
      openingHours: row.openingHours,
      deliveryLink: row.deliveryLink,
      mapEmbedUrl: row.mapEmbedUrl,
      mapUrl: mapSearchUrl(address || localized(row.name as LocalizedText, locale), locale),
    };
  });
}

function localized(value: LocalizedText, locale: Locale): string {
  return value[locale] ?? value.id ?? value.en ?? value.zh ?? '';
}

function fallbackLocations(locale: Locale) {
  return PUBLIC_STORE_FALLBACKS.map((store) => ({
    id: store.id,
    code: store.code,
    name: localized(store.name, locale),
    type: store.type,
    address: store.address,
    openingHours: store.openingHours,
    deliveryLink: store.deliveryLink,
    mapEmbedUrl: store.mapEmbedUrl,
    mapUrl: mapSearchUrl(store.address, locale),
  }));
}

function normalizeAddress(code: string, address: string | null): string {
  const fallback = PUBLIC_STORE_FALLBACKS.find((store) => store.code === code);
  if (!address) return fallback?.address ?? '';
  const compact = address.trim().toLowerCase();
  if (
    fallback &&
    (compact === 'malioboro mall, yogyakarta' || compact === 'plaza malioboro, yogyakarta')
  ) {
    return fallback.address;
  }
  return address;
}

function mapSearchUrl(query: string, locale: Locale): string {
  // Use Google Maps as the primary map provider.
  const encoded = encodeURIComponent(query);
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}
