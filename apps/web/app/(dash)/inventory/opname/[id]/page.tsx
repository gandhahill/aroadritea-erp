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

import { getSession } from '@/lib/auth';
import type { OpnameLineResult } from '@erp/services/inventory/opname-service';
import type { Metadata } from 'next';
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

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Draf', bg: 'bg-brand-cream-2', text: 'text-brand-ink-2' },
  in_progress: { label: 'Sedang Berlangsung', bg: 'bg-brand-gold/10', text: 'text-brand-gold' },
  submitted: { label: 'Diajukan', bg: 'bg-brand-gold/20', text: 'text-brand-gold' },
  approved: { label: 'Disetujui', bg: 'bg-brand-jade/10', text: 'text-brand-jade' },
  cancelled: { label: 'Dibatalkan', bg: 'bg-rose-50', text: 'text-rose-500' },
};

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
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const result = await loadOpnameSessionAction(id);
  if (result.error || !result.data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-brand-ink-3">Sesi opname tidak ditemukan.</p>
      </div>
    );
  }

  const data = result.data;
  const statusCfg = STATUS_CONFIG[data.status] ?? {
    label: data.status,
    bg: 'bg-brand-cream-2',
    text: 'text-brand-ink-2',
  };

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-sm text-brand-ink-3">
            <a href="/inventory/opname" className="hover:text-brand-ink">
              Stock Opname
            </a>
            <span>/</span>
            <span className="font-medium">{data.number}</span>
          </div>
          <h1 className="text-2xl font-bold text-brand-ink">{data.number}</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            Tanggal sesi {data.sessionDate} · Periode {data.periodCode}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${statusCfg.bg} ${statusCfg.text}`}
          >
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Workflow progress bar */}
      <OpnameWorkflowBar status={data.status} />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Baris"
          value={String(totalLines)}
          sub={`${countedLines} sudah dihitung`}
          color="text-brand-ink"
        />
        <StatCard
          label="Baris dengan Selisih"
          value={String(linesWithVariance.length)}
          sub={
            linesWithVariance.length > 0
              ? `${surplusLines.length} +, ${shortageLines.length} −`
              : 'Semua sesuai'
          }
          color={linesWithVariance.length > 0 ? 'text-brand-gold' : 'text-brand-jade'}
        />
        <StatCard
          label="Total Nilai Selisih"
          value={formatMoney(totalVarianceValue)}
          sub={
            totalVarianceValue === 0
              ? 'Sesuai'
              : totalVarianceValue > 0
                ? 'Kelebihan'
                : 'Kekurangan'
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
          label="Jurnal Penyesuaian"
          value={data.journalEntryId ? data.journalEntryId.slice(0, 8) + '…' : '—'}
          sub={data.journalEntryId ? 'Sudah dibuat' : 'Belum dibuat'}
          color={data.journalEntryId ? 'text-brand-jade' : 'text-brand-ink-3'}
        />
      </div>

      {/* Input progress card (draft / in_progress) */}
      {(data.status === 'draft' || data.status === 'in_progress') && (
        <div className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-ink">Input Hitung Fisik</h2>
            <span className="text-xs text-brand-ink-3">
              {countedLines} / {totalLines} baris dihitung
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
              ? `${totalLines - countedLines} baris belum dihitung. Isi kolom "Dihitung" lalu klik "Simpan".`
              : 'Semua baris sudah dihitung. Klik "Ajukan Opname" untuk menghitung selisih.'}
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
              </svg>
              Ajukan Opname
            </button>
          </form>
          <form
            action={async () => {
              'use server';
              await cancelOpnameAction(id);
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
            >
              Batalkan
            </button>
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
              </svg>
              Setujui
            </button>
          </form>
          <form
            action={async () => {
              'use server';
              await cancelOpnameAction(id);
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
            >
              Batalkan
            </button>
          </form>
        </div>
      )}

      {/* Variance info banner */}
      {data.status === 'submitted' && linesWithVariance.length > 0 && (
        <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-4 py-3 text-sm text-brand-ink">
          <strong>Selisih ditemukan:</strong> {linesWithVariance.length} baris. Setelah disetujui,
          jurnal penyesuaian otomatis dibuat — shortage: DR Beban Operasional / CR Persediaan;
          surplus: DR Persediaan / CR Pendapatan Lainnya.
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
