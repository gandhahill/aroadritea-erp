/**
 * Locations Page — SD §22.2
 * Lists all store branches.
 */
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function LocationsPage({ params }: Props) {
  const { locale } = await params;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-8 text-center text-3xl font-bold text-brand-ink">Lokasi Toko</h1>
      <div className="grid gap-6 md:grid-cols-2">
        {STORES.map((s) => (
          <div
            key={s.name}
            className="rounded-xl border border-brand-cream-3 bg-white p-6 shadow-sm"
          >
            <h2 className="font-semibold text-brand-red">{s.name}</h2>
            <p className="mt-1 text-sm text-brand-ink-3">{s.address}</p>
            <div className="mt-3 space-y-1 text-sm text-brand-ink-2">
              <p>🕐 {s.hours}</p>
              <p>📞 {s.phone}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Placeholder — replaced by DB in production
const STORES = [
  {
    name: 'Toko Malioboro',
    address: 'Malioboro Mall, Yogyakarta',
    hours: '10:00 – 22:00 WIB',
    phone: '(0274)',
  },
  {
    name: 'Toko Plaza Malioboro',
    address: 'Plaza Malioboro, Yogyakarta',
    hours: '10:00 – 22:00 WIB',
    phone: '(0274)',
  },
  { name: 'Kantor Yogyakarta', address: 'Yogyakarta', hours: '09:00 – 17:00 WIB', phone: '(021)' },
  { name: 'Kantor Jakarta', address: 'Jakarta', hours: '09:00 – 17:00 WIB', phone: '(021)' },
];
