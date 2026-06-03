import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import {
  getActiveLocationOptions,
  resolveDefaultLocationId,
  type LocationOption,
} from '@/lib/location-options';
import {
  getFinancialCloseCenter,
  type FinancialCloseCenterResult,
  type FinancialCloseChecklistItem,
  type FinancialCloseStatus,
} from '@erp/services/accounting';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('accounting.closeCenter');
  return { title: t('title') };
}

export default async function FinancialCloseCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ periodCode?: string; locationId?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');
  const sessionLocationId = typeof user.locationId === 'string' ? user.locationId : undefined;
  const rawLocale = await getLocale().catch(() => 'id');
  const locale = rawLocale === 'en' || rawLocale === 'zh' ? rawLocale : 'id';
  const t = await getTranslations('accounting.closeCenter');
  const params = await searchParams;
  const periodCode = normalizePeriodCode(params.periodCode);
  const locationOptions = await getActiveLocationOptions({ tenantId, locale });
  const locationId = resolveDefaultLocationId(
    locationOptions,
    params.locationId,
    sessionLocationId,
  );

  const result = locationId
    ? await getFinancialCloseCenter(
        { periodCode, locationId },
        { tenantId, userId, locationId },
      )
    : await getFinancialCloseCenter(
        { periodCode },
        { tenantId, userId, locationId: '' },
      );

  if (!result.ok && result.error.code === 'FORBIDDEN') redirect('/dashboard');

  const data = result.ok ? result.value : null;
  const selectedLocation = locationOptions.find((option) => option.id === locationId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('title')}</>}
        description={<>{t('subtitle')}</>}
        breadcrumbs={[
          { label: t('breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('breadcrumbs.accounting') },
          { label: t('breadcrumbs.closeCenter') },
        ]}
      />

      <FilterBar
        periodCode={periodCode}
        locationId={locationId}
        locationOptions={locationOptions}
        labels={{
          period: t('filters.period'),
          location: t('filters.location'),
          apply: t('filters.apply'),
          noLocation: t('filters.noLocation'),
        }}
      />

      {data ? (
        <CloseCenterDashboard
          data={data}
          selectedLocation={selectedLocation}
          locale={locale}
          labels={{
            overallStatus: t('overallStatus'),
            readiness: t('cards.readiness'),
            blocked: t('cards.blocked'),
            warnings: t('cards.warnings'),
            ready: t('cards.ready'),
            periodRange: t('periodRange'),
            selectedLocation: t('selectedLocation'),
            checklist: t('checklist'),
            openLink: t('openLink'),
            countLabels: t.raw('countLabels') as Record<string, string>,
            items: t.raw('items') as Record<string, { title: string; description: string }>,
            statuses: t.raw('statuses') as Record<FinancialCloseStatus, string>,
            periodStatuses: t.raw('periodStatuses') as Record<string, string>,
          }}
        />
      ) : (
        <div className="rounded-lg border border-brand-red/20 bg-brand-red/10 p-5">
          <h2 className="font-display text-lg font-semibold text-brand-ink">
            {t('errors.unavailableTitle')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-brand-muted">
            {t('errors.unavailableBody')}
          </p>
        </div>
      )}
    </div>
  );
}

function FilterBar({
  periodCode,
  locationId,
  locationOptions,
  labels,
}: {
  periodCode: string;
  locationId: string;
  locationOptions: LocationOption[];
  labels: {
    period: string;
    location: string;
    apply: string;
    noLocation: string;
  };
}) {
  return (
    <form
      method="get"
      className="grid gap-3 rounded-lg border border-brand-ink/10 bg-brand-porcelain p-4 md:grid-cols-[180px_minmax(220px,1fr)_auto]"
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-brand-ink">
        <span>{labels.period}</span>
        <input
          type="month"
          name="periodCode"
          defaultValue={periodCode}
          className="h-10 rounded-md border border-brand-cream-3 bg-brand-paper px-3 text-sm text-brand-ink outline-none focus:border-brand-red"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-brand-ink">
        <span>{labels.location}</span>
        <select
          name="locationId"
          defaultValue={locationId}
          className="h-10 rounded-md border border-brand-cream-3 bg-brand-paper px-3 text-sm text-brand-ink outline-none focus:border-brand-red"
          disabled={locationOptions.length === 0}
        >
          {locationOptions.length === 0 ? (
            <option value="">{labels.noLocation}</option>
          ) : (
            locationOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))
          )}
        </select>
      </label>

      <button
        type="submit"
        className="self-end rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-brand-porcelain transition hover:bg-brand-red-dark"
      >
        {labels.apply}
      </button>
    </form>
  );
}

function CloseCenterDashboard({
  data,
  selectedLocation,
  locale,
  labels,
}: {
  data: FinancialCloseCenterResult;
  selectedLocation: LocationOption | null;
  locale: string;
  labels: {
    overallStatus: string;
    readiness: string;
    blocked: string;
    warnings: string;
    ready: string;
    periodRange: string;
    selectedLocation: string;
    checklist: string;
    openLink: string;
    countLabels: Record<string, string>;
    items: Record<string, { title: string; description: string }>;
    statuses: Record<FinancialCloseStatus, string>;
    periodStatuses: Record<string, string>;
  };
}) {
  const statusLabel = labels.statuses[data.status];

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          label={labels.readiness}
          value={`${data.readinessPercent}%`}
          status={data.status}
        />
        <SummaryCard
          label={labels.blocked}
          value={formatInteger(data.summary.blocked, locale)}
          status={data.summary.blocked > 0 ? 'blocked' : 'ready'}
        />
        <SummaryCard
          label={labels.warnings}
          value={formatInteger(data.summary.warning, locale)}
          status={data.summary.warning > 0 ? 'warning' : 'ready'}
        />
        <SummaryCard
          label={labels.ready}
          value={`${formatInteger(data.summary.ready, locale)}/${formatInteger(data.summary.total, locale)}`}
          status="ready"
        />
      </div>

      <div className="rounded-lg border border-brand-ink/10 bg-brand-porcelain p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">
              {labels.overallStatus}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill status={data.status} label={statusLabel} />
              {data.period.status && (
                <span className="rounded-full border border-brand-ink/10 bg-brand-paper px-3 py-1 text-xs font-semibold text-brand-muted">
                  {labels.periodStatuses[data.period.status] ?? labels.periodStatuses.unknown}
                </span>
              )}
            </div>
          </div>
          <div className="grid gap-2 text-sm text-brand-muted md:text-right">
            <p>
              <span className="font-semibold text-brand-ink">{labels.periodRange}</span>{' '}
              {formatDate(data.period.startDate, locale)} - {formatDate(data.period.endDate, locale)}
            </p>
            <p>
              <span className="font-semibold text-brand-ink">{labels.selectedLocation}</span>{' '}
              {selectedLocation?.label ?? data.locationId ?? '-'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-brand-ink">{labels.checklist}</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {data.checklist.map((item) => (
            <ChecklistCard
              key={item.id}
              item={item}
              labels={{
                item: labels.items[item.id],
                status: labels.statuses[item.status],
                openLink: labels.openLink,
                countLabels: labels.countLabels,
                periodStatuses: labels.periodStatuses,
              }}
              locale={locale}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: FinancialCloseStatus;
}) {
  return (
    <div className={`rounded-lg border p-4 ${statusCardClass(status)}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-brand-ink">{value}</p>
    </div>
  );
}

function ChecklistCard({
  item,
  labels,
  locale,
}: {
  item: FinancialCloseChecklistItem;
  labels: {
    item: { title: string; description: string } | undefined;
    status: string;
    openLink: string;
    countLabels: Record<string, string>;
    periodStatuses: Record<string, string>;
  };
  locale: string;
}) {
  const visibleCounts = Object.entries(item.counts).filter(([key]) => labels.countLabels[key]);
  return (
    <article className={`rounded-lg border p-5 ${statusCardClass(item.status)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-brand-ink">
            {labels.item?.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-brand-muted">{labels.item?.description}</p>
        </div>
        <StatusPill status={item.status} label={labels.status} />
      </div>

      {item.meta?.periodStatus && (
        <div className="mt-3 text-sm text-brand-muted">
          {labels.periodStatuses[item.meta.periodStatus] ?? labels.periodStatuses.unknown}
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {visibleCounts.map(([key, value]) => (
          <div key={key} className="rounded-md border border-brand-ink/10 bg-brand-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
              {labels.countLabels[key]}
            </p>
            <p className="mt-1 text-xl font-semibold text-brand-ink">
              {formatInteger(value, locale)}
            </p>
          </div>
        ))}
      </div>

      <Link
        href={item.href}
        className="mt-4 inline-flex rounded-md border border-brand-red/30 px-3 py-2 text-sm font-semibold text-brand-red transition hover:bg-brand-red/10"
      >
        {labels.openLink}
      </Link>
    </article>
  );
}

function StatusPill({ status, label }: { status: FinancialCloseStatus; label: string }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass(status)}`}>
      {label}
    </span>
  );
}

function statusCardClass(status: FinancialCloseStatus) {
  if (status === 'blocked') return 'border-brand-red/25 bg-brand-red/10 text-brand-red';
  if (status === 'warning') return 'border-brand-gold/40 bg-brand-gold/15 text-brand-wood';
  return 'border-brand-jade/25 bg-brand-jade/10 text-brand-jade';
}

function statusPillClass(status: FinancialCloseStatus) {
  if (status === 'blocked') return 'border-brand-red/30 bg-brand-red/10 text-brand-red';
  if (status === 'warning') return 'border-brand-gold/40 bg-brand-gold/15 text-brand-wood';
  return 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade';
}

function normalizePeriodCode(value: string | undefined) {
  if (value && /^\d{4}-\d{2}$/.test(value)) return value;
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

function formatInteger(value: number, locale: string) {
  return new Intl.NumberFormat(toIntlLocale(locale), { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00.000+07:00`));
}

function toIntlLocale(locale: string) {
  if (locale === 'zh') return 'zh-CN';
  if (locale === 'en') return 'en-GB';
  return 'id-ID';
}
