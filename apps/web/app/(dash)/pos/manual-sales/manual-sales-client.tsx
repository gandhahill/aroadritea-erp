'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect } from 'react';
import { createManualSalesAction, type ManualSalesPageData } from './actions';
import { Pagination } from '@/components/pagination';
import { ExportManualSalesButton } from './export-manual-sales-button';

const INPUT =
  'w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5';

interface Props {
  data: ManualSalesPageData;
  defaultLocationId: string;
}

export function ManualSalesClient({ data, defaultLocationId }: Props) {
  const t = useTranslations('pos.manualSales');
  const pagination = useTranslations('common.pagination');
  const [state, submitAction, isPending] = useActionState(createManualSalesAction, null);

  useEffect(() => {
    if (state?.ok) {
      const form = document.getElementById('manual-sales-form') as HTMLFormElement | null;
      form?.reset();
    }
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hasPrevious = data.page > 1;
  const hasNext = data.page < totalPages;
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (defaultLocationId) params.set('locationId', defaultLocationId);
    return `/pos/manual-sales?${params.toString()}`;
  };

  return (
    <div className="h-full w-full overflow-y-auto space-y-6 pb-24 px-4 pt-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">
          {t('eyebrow')}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 max-w-3xl text-sm text-brand-ink-3">{t('subtitle')}</p>
      </div>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <form id="manual-sales-form" action={submitAction} className="grid gap-4 lg:grid-cols-4">
          <Field label={t('location')}>
            <select name="locationId" defaultValue={defaultLocationId} className={INPUT} required>
              {data.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('salesDate')}>
            <input name="salesDate" type="date" defaultValue={today} className={INPUT} required />
          </Field>
          <Field label={t('channel')}>
            <select name="channel" defaultValue="walk_in" className={INPUT}>
              <option value="walk_in">{t('walkIn')}</option>
              <option value="gofood">GoFood</option>
              <option value="grabfood">GrabFood</option>
              <option value="shopeefood">ShopeeFood</option>
            </select>
          </Field>
          <Field label={t('paymentMethod')}>
            <select name="paymentMethod" defaultValue="cash" className={INPUT}>
              <option value="cash">{t('cash')}</option>
              <option value="qris">QRIS</option>
              <option value="debit">Debit</option>
              <option value="credit">{t('credit')}</option>
              <option value="gofood">GoFood</option>
              <option value="grabfood">GrabFood</option>
              <option value="shopeefood">ShopeeFood</option>
            </select>
          </Field>
          <Field label={t('grossSales')}>
            <input name="grossSales" inputMode="numeric" className={INPUT} required />
          </Field>
          <Field label={t('discountTotal')}>
            <input name="discountTotal" inputMode="numeric" defaultValue="0" className={INPUT} />
          </Field>
          <Field label={t('transactionCount')}>
            <input name="transactionCount" type="number" min={0} defaultValue={0} className={INPUT} />
          </Field>
          <Field label={t('sourceReference')}>
            <input name="sourceReference" className={INPUT} />
          </Field>
          <div className="lg:col-span-3">
            <Field label={t('notes')}>
              <textarea name="notes" rows={3} className={INPUT} />
            </Field>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isPending || data.locations.length === 0}
              className="w-full rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
            >
              {isPending ? t('posting') : t('post')}
            </button>
          </div>
          {state?.error ? (
            <div className="lg:col-span-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {state.error}
            </div>
          ) : null}
          {state?.ok ? (
            <div className="lg:col-span-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {t('posted')}
            </div>
          ) : null}
        </form>
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <div className="border-b border-brand-cream-3 px-5 py-4 flex justify-between items-center">
          <h2 className="text-base font-semibold text-brand-ink">{t('history')}</h2>
          <ExportManualSalesButton locationId={defaultLocationId} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
            <thead className="bg-brand-cream">
              <tr className="text-left text-brand-ink-2">
                <Th>{t('number')}</Th>
                <Th>{t('salesDate')}</Th>
                <Th>{t('channel')}</Th>
                <Th>{t('paymentMethod')}</Th>
                <Th align="right">{t('grossSales')}</Th>
                <Th align="right">{t('taxTotal')}</Th>
                <Th align="right">{t('netRevenue')}</Th>
                <Th>{t('journal')}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-brand-ink-3">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id} className="text-brand-ink">
                    <Td>{item.number}</Td>
                    <Td>{item.salesDate}</Td>
                    <Td>{item.channel}</Td>
                    <Td>{item.paymentMethod}</Td>
                    <Td align="right">{formatRupiah(item.grossSales)}</Td>
                    <Td align="right">{formatRupiah(item.taxTotal)}</Td>
                    <Td align="right">{formatRupiah(item.netRevenue)}</Td>
                    <Td>{item.journalEntryId ? t('synced') : t('notSynced')}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
          <Pagination 
            currentPage={data.page} 
            totalItems={data.total} 
            pageSize={data.pageSize} 
          />
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-brand-ink">{label}</span>
      {children}
    </label>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th className={`px-4 py-3 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <td className={`whitespace-nowrap px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  );
}

function PaginationLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-md border border-brand-cream-3 px-3 py-1.5 text-brand-ink-3 opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-md border border-brand-cream-3 px-3 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-cream"
    >
      {children}
    </Link>
  );
}

function formatRupiah(value: string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}
