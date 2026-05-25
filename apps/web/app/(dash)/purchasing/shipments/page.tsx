import { PageHeader } from '@/components/page-header';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { fetchShipmentDashboard } from '../actions';
import { ShipmentsTable } from './shipments-table';

export default async function ShipmentsPage() {
  const [data, t] = await Promise.all([
    fetchShipmentDashboard(),
    getTranslations('purchasing.shipments'),
  ]);

  return (
    <main className="min-h-screen bg-brand-paper">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8 lg:px-8">
        <PageHeader
          title={<>{t('title')}</>}
          description={<>{t('subtitle')}</>}
          eyebrow={<>{t('eyebrow')}</>}
          actions={
            <Link
              href="/purchasing"
              className="inline-flex items-center justify-center rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-cream-1"
            >
              {t('back')}
            </Link>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          <KpiTile label={t('kpi.total')} value={data.total} tone="muted" />
          <KpiTile label={t('kpi.withShipping')} value={data.withShipping} tone="muted" />
          <KpiTile label={t('kpi.inTransit')} value={data.inTransit} tone="gold" />
          <KpiTile label={t('kpi.delivered')} value={data.delivered} tone="jade" />
        </div>

        {data.errored > 0 ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {t('errorsBanner', { count: data.errored })}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
          <div className="border-b border-brand-cream-3 px-5 py-4">
            <h2 className="text-base font-semibold text-brand-ink">{t('tableTitle')}</h2>
          </div>
          <ShipmentsTable rows={data.rows} />
        </div>
      </section>
    </main>
  );
}

function KpiTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'muted' | 'gold' | 'jade';
}) {
  const toneClass =
    tone === 'gold' ? 'text-brand-wood' : tone === 'jade' ? 'text-brand-jade' : 'text-brand-ink';
  return (
    <div className="rounded-lg border border-brand-cream-3 bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
