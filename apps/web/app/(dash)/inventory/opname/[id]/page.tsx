/**
 * Stock Opname Session Detail Page — SD §25.9
 *
 * Shows session header + workflow + stats + line table.
 * Actions change by status:
 *   draft / in_progress  → "Simpan" per line via OpnameLineTable
 *   in_progress + all counted → "Ajukan Opname"
 *   submitted            → "Setujui" / "Batalkan"
 *   approved / cancelled → read-only
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { OpnameLineResult } from '@erp/services/inventory/opname-service';
import { Button } from '@erp/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import {
  approveOpnameAction,
  cancelOpnameAction,
  loadOpnameSessionAction,
  submitOpnameAction,
} from '../actions';
import { OpnameLineTable } from './opname-lines-table';
import { OpnameWorkflowBar } from './opname-workflow-bar';

export const metadata: Metadata = { title: 'Stock Opname' };

// STATUS_CONFIG is handled dynamically now

function formatMoney(v: string | number | bigint | null | undefined): string {
  if (!v) return '—';
  const num = typeof v === 'string' ? Number.parseInt(v, 10) : Number(v);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
}

export default async function OpnameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations('inventory.opnameDetail');
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const result = await loadOpnameSessionAction(id);
  if (result.error || !result.data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-brand-ink-3">{t('notFound')}</p>
      </div>
    );
  }

  const data = result.data;
  const getStatusCfg = (status: string) => {
    switch (status) {
      case 'draft':
        return { label: t('status.draft'), bg: 'bg-brand-cream-2', text: 'text-brand-ink-2' };
      case 'in_progress':
        return { label: t('status.in_progress'), bg: 'bg-brand-gold/10', text: 'text-brand-gold' };
      case 'submitted':
        return { label: t('status.submitted'), bg: 'bg-brand-gold/20', text: 'text-brand-gold' };
      case 'approved':
        return { label: t('status.approved'), bg: 'bg-brand-jade/10', text: 'text-brand-jade' };
      case 'cancelled':
        return { label: t('status.cancelled'), bg: 'bg-rose-50', text: 'text-rose-500' };
      default:
        return { label: status, bg: 'bg-brand-cream-2', text: 'text-brand-ink-2' };
    }
  };
  const statusCfg = getStatusCfg(data.status);

  const totalLines = data.lines.length;
  const countedLines = data.lines.filter((l: OpnameLineResult) => l.isCounted).length;
  const linesWithVariance = data.lines.filter(
    (l: OpnameLineResult) => l.varianceQty && Number.parseFloat(l.varianceQty) !== 0,
  );

  const totalVarianceValue = linesWithVariance.reduce(
    (sum: number, l: OpnameLineResult) =>
      sum + (l.varianceValue ? Number.parseInt(String(l.varianceValue), 10) : 0),
    0,
  );
  const surplusLines = linesWithVariance.filter(
    (l: OpnameLineResult) => Number.parseFloat(l.varianceQty ?? '0') > 0,
  );
  const shortageLines = linesWithVariance.filter(
    (l: OpnameLineResult) => Number.parseFloat(l.varianceQty ?? '0') < 0,
  );

  const isPendingSubmit =
    data.status === 'in_progress' && countedLines === totalLines && totalLines > 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <PageHeader
        title={<>{data.number}</>}
        description={
          <>
            {t('sessionDate')} {data.sessionDate} · {t('period')} {data.periodCode}
          </>
        }
        eyebrow={
          <div className="mb-1.5 flex items-center gap-2 text-sm text-brand-ink-3">
            <a href="/inventory/opname" className="hover:text-brand-ink">
              {t('breadcrumbOpname')}
            </a>
            <span>/</span>
            <span className="font-medium">{data.number}</span>
          </div>
        }
        actions={
          <>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${statusCfg.bg} ${statusCfg.text}`}
              >
                {statusCfg.label}
              </span>
            </div>
          </>
        }
      />

      {/* Workflow progress bar */}
      <OpnameWorkflowBar status={data.status} />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('statTotalLines')}
          value={String(totalLines)}
          sub={t('statLinesCounted', { count: countedLines })}
          color="text-brand-ink"
        />
        <StatCard
          label={t('statVarianceLines')}
          value={String(linesWithVariance.length)}
          sub={
            linesWithVariance.length > 0
              ? `${surplusLines.length} +, ${shortageLines.length} −`
              : t('statAllMatch')
          }
          color={linesWithVariance.length > 0 ? 'text-brand-gold' : 'text-brand-jade'}
        />
        <StatCard
          label={t('statTotalVarianceValue')}
          value={formatMoney(totalVarianceValue)}
          sub={
            totalVarianceValue === 0
              ? t('statValueMatch')
              : totalVarianceValue > 0
                ? t('statSurplus')
                : t('statShortage')
          }
          color={
            totalVarianceValue === 0
              ? 'text-brand-jade'
              : totalVarianceValue > 0
                ? 'text-brand-jade'
                : 'text-rose-500'
          }
        />
        <StatCard
          label={t('statJournal')}
          value={data.journalEntryId ? t('statRecorded') : t('statNotRecorded')}
          sub={data.journalEntryId ? t('statViewJournal') : t('statJournalWillBeCreated')}
          color={data.journalEntryId ? 'text-brand-jade' : 'text-brand-ink-3'}
        />
      </div>

      {/* Input progress card (draft / in_progress) */}
      {(data.status === 'draft' || data.status === 'in_progress') && (
        <div className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-ink">{t('inputTitle')}</h2>
            <span className="text-xs text-brand-ink-3">
              {t('linesCountedSuffix', { counted: countedLines, total: totalLines })}
            </span>
          </div>
          <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-brand-cream-2">
            <div
              className="h-full rounded-full bg-brand-ember-5 transition-all"
              style={{ width: `${totalLines > 0 ? (countedLines / totalLines) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-brand-ink-3">
            {countedLines < totalLines
              ? t('uncountedInfo', { count: totalLines - countedLines })
              : t('allCountedInfo')}
          </p>
        </div>
      )}

      {/* Action buttons */}
      {isPendingSubmit && (
        <div className="flex items-center justify-end gap-3">
          <form
            action={async () => {
              'use server';
              await submitOpnameAction(id);
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-gold/90"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>{' '}
              {t('btnSubmit')}{' '}
            </button>
          </form>
          <form
            action={async () => {
              'use server';
              await cancelOpnameAction(id);
            }}
          >
            <Button
              type="submit"
              className="rounded-lg border border-rose-200 bg-card px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
              variant="danger"
              size="sm"
            >
              {' '}
              {t('btnCancel')}{' '}
            </Button>
          </form>
        </div>
      )}

      {data.status === 'submitted' && (
        <div className="flex items-center justify-end gap-3">
          <form
            action={async () => {
              'use server';
              await approveOpnameAction(id);
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-jade px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-jade/90"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>{' '}
              {t('btnApprove')}{' '}
            </button>
          </form>
          <form
            action={async () => {
              'use server';
              await cancelOpnameAction(id);
            }}
          >
            <Button
              type="submit"
              className="rounded-lg border border-rose-200 bg-card px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
              variant="danger"
              size="sm"
            >
              {' '}
              {t('btnCancel')}{' '}
            </Button>
          </form>
        </div>
      )}

      {/* Variance info banner */}
      {data.status === 'submitted' && linesWithVariance.length > 0 && (
        <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-4 py-3 text-sm text-brand-ink">
          <strong>{t('varianceFound', { count: linesWithVariance.length })}</strong>{' '}
          {t('varianceInfoSuffix')}
        </div>
      )}

      {/* Line table */}
      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <OpnameLineTable lines={data.lines} status={data.status} sessionId={id} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-ink-3">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-brand-ink-3">{sub}</p>
    </div>
  );
}
