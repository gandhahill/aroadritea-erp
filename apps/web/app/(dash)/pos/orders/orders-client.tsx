'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  type OrderDetail,
  type OrderListRow,
  fetchOrderDetail,
  refundOrderAction,
  voidOrderAction,
} from './actions';

interface Props {
  rows: OrderListRow[];
}

function formatRupiah(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatQty(value: string | number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/\.?0+$/, '');
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function channelLabel(channel: string, t: any): string {
  switch (channel) {
    case 'dine_in':
    case 'walk_in':
      return t('typeDineIn');
    case 'take_away':
      return t('typeTakeaway');
    case 'gofood':
      return 'GoFood';
    case 'grabfood':
      return 'GrabFood';
    case 'shopeefood':
      return 'ShopeeFood';
    default:
      return channel
        .split(/[_-]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
  }
}

function statusBadge(status: string, t: any): { label: string; cls: string } {
  switch (status) {
    case 'paid':
      return { label: t('statusPaid_label'), cls: 'bg-brand-jade-light text-brand-jade' };
    case 'open':
      return { label: t('statusPending_label'), cls: 'bg-brand-cream-2 text-brand-ink-3' };
    case 'refunded':
      return { label: t('statusRefunded_label'), cls: 'bg-brand-clay-light text-brand-clay' };
    case 'voided':
      return { label: t('statusVoided_label'), cls: 'bg-rose-100 text-rose-700' };
    default:
      return { label: status, cls: 'bg-brand-cream-2 text-brand-ink-3' };
  }
}

export function OrdersClient({ rows }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [modal, setModal] = useState<'void' | 'refund' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [refundLines, setRefundLines] = useState<Map<string, number>>(new Map());

  const t = useTranslations('pos.orders');

  async function openDetail(orderId: string) {
    setSelectedId(orderId);
    setLoadingDetail(true);
    setDetail(null);
    setError(null);
    const res = await fetchOrderDetail(orderId);
    setLoadingDetail(false);
    if (!res.ok || !res.detail) {
      setError(res.error ?? 'Gagal memuat detail pesanan.');
      return;
    }
    setDetail(res.detail);
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setModal(null);
    setReason('');
    setError(null);
    setRefundLines(new Map());
  }

  function openModal(kind: 'void' | 'refund') {
    setModal(kind);
    setReason('');
    setError(null);
    if (kind === 'refund' && detail) {
      const lines = new Map<string, number>();
      for (const l of detail.lines) {
        lines.set(l.id, Math.round(Number(l.qty)));
      }
      setRefundLines(lines);
    }
  }

  function submitModal() {
    if (!detail || !modal) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError('Alasan wajib diisi (minimal 3 karakter).');
      return;
    }
    startSubmit(async () => {
      if (modal === 'void') {
        const res = await voidOrderAction({
          orderId: detail.id,
          reason: trimmed,
          version: detail.version,
        });
        if (!res.ok) {
          setError(res.error ?? 'Gagal memproses permintaan.');
          return;
        }
      } else {
        const lines = Array.from(refundLines.entries())
          .filter(([, qty]) => qty > 0)
          .map(([lineId, qty]) => ({ lineId, qty }));
        if (lines.length === 0) {
          setError('Pilih minimal satu item untuk di-refund.');
          return;
        }
        const res = await refundOrderAction({
          orderId: detail.id,
          reason: trimmed,
          version: detail.version,
          lines,
        });
        if (!res.ok) {
          setError(res.error ?? 'Gagal memproses permintaan.');
          return;
        }
      }
      closeDetail();
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-brand-cream-3 bg-card p-10 text-center text-sm text-brand-ink-3">
        {t('empty')}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
          <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
            <tr>
              <th className="px-4 py-3">{t('table.orderNo')}</th>
              <th className="px-4 py-3">{t('table.time')}</th>
              <th className="px-4 py-3">{t('table.channel')}</th>
              <th className="px-4 py-3">Kasir</th>
              <th className="px-4 py-3">Metode</th>
              <th className="px-4 py-3 text-right">{t('table.total')}</th>
              <th className="px-4 py-3">{t('table.status')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3">
            {rows.map((r) => {
              const isSelected = selectedId === r.id;
              const status = statusBadge(r.status, t);
              return (
                <tr
                  key={r.id}
                  className={`cursor-pointer ${
                    isSelected ? 'bg-brand-red/5' : 'hover:bg-brand-cream-1/60'
                  }`}
                  onClick={() => openDetail(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openDetail(r.id);
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-brand-ink">{r.number}</td>
                  <td className="px-4 py-2.5 text-xs text-brand-ink-2">{formatTime(r.placedAt)}</td>
                  <td className="px-4 py-2.5 text-xs text-brand-ink-2">
                    {channelLabel(r.channel, t)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-brand-ink-2">{r.cashierName}</td>
                  <td className="px-4 py-2.5 text-xs text-brand-ink-2">
                    {r.paymentMethods.length > 0 ? r.paymentMethods.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-brand-ink">
                    {formatRupiah(r.grandTotal)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${status.cls}`}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      className="rounded-md border border-brand-cream-3 px-2.5 py-1 text-xs font-semibold text-brand-ink-2 hover:bg-brand-cream-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(r.id);
                      }}
                    >
                      {t('detail')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <aside className="rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm">
        {!selectedId ? (
          <div className="py-10 text-center text-sm text-brand-ink-3">
            Pilih pesanan di tabel untuk melihat detail.
          </div>
        ) : loadingDetail ? (
          <div className="py-10 text-center text-sm text-brand-ink-3">Memuat detail…</div>
        ) : !detail ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error ?? 'Detail tidak tersedia.'}
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-brand-ink-3">Pesanan</p>
                <p className="font-mono text-base font-semibold text-brand-ink">{detail.number}</p>
                <p className="mt-0.5 text-xs text-brand-ink-3">
                  {channelLabel(detail.channel, t)} · {detail.cashierName} ·{' '}
                  {formatTime(detail.placedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-md p-1 text-brand-ink-3 hover:bg-brand-cream-2"
                aria-label="Tutup"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-3 rounded-md border border-brand-cream-3">
              <table className="w-full text-xs">
                <thead className="bg-brand-cream-1 text-left uppercase tracking-wider text-brand-ink-3">
                  <tr>
                    <th className="px-2.5 py-1.5">Produk</th>
                    <th className="px-2.5 py-1.5 text-right">Qty</th>
                    <th className="px-2.5 py-1.5 text-right">Harga</th>
                    <th className="px-2.5 py-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-cream-3">
                  {detail.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-2.5 py-1.5 text-brand-ink">{l.productName}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{formatQty(l.qty)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">
                        {formatRupiah(l.unitPrice)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">
                        {formatRupiah(l.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="mt-3 space-y-1 text-xs text-brand-ink-2">
              <Row label="Subtotal" value={formatRupiah(detail.subtotal)} />
              {detail.discountTotal !== '0' ? (
                <Row label="Diskon" value={`-${formatRupiah(detail.discountTotal)}`} />
              ) : null}
              <Row label="PB1 (incl.)" value={formatRupiah(detail.taxTotal)} />
              <Row label="Total" value={formatRupiah(detail.grandTotal)} bold />
              <div className="mt-2 border-t border-dashed border-brand-cream-3 pt-2 space-y-0.5">
                {detail.paymentRows.length === 0 ? (
                  <p className="text-brand-ink-3">Belum ada pembayaran.</p>
                ) : (
                  detail.paymentRows.map((p) => (
                    <div key={p.id} className="flex justify-between">
                      <span className="uppercase">{p.method}</span>
                      <span className="tabular-nums">{formatRupiah(p.amount)}</span>
                    </div>
                  ))
                )}
              </div>
              {detail.notes ? (
                <p className="mt-2 rounded-md bg-brand-cream-1 px-2 py-1.5 text-[11px] text-brand-ink-3">
                  <span className="font-semibold">Catatan: </span>
                  {detail.notes}
                </p>
              ) : null}
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={detail.status !== 'open'}
                onClick={() => openModal('void')}
                className="flex-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                title={detail.status !== 'open' ? 'Hanya pesanan terbuka yang bisa di-void.' : ''}
              >
                Void Pesanan
              </button>
              <button
                type="button"
                disabled={detail.status !== 'paid'}
                onClick={() => openModal('refund')}
                className="flex-1 rounded-md border border-brand-clay/40 bg-brand-clay-light px-3 py-2 text-xs font-semibold text-brand-clay hover:bg-brand-clay/15 disabled:cursor-not-allowed disabled:opacity-40"
                title={detail.status !== 'paid' ? 'Hanya pesanan lunas yang bisa di-refund.' : ''}
              >
                Refund Pesanan
              </button>
            </div>

            {error && !modal ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
          </>
        )}
      </aside>

      {modal && detail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="close"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setModal(null)}
          />
          <div className="relative z-10 flex w-full max-w-md flex-col rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl">
            <div className="border-b border-brand-cream-3 px-5 py-4">
              <h3 className="text-base font-semibold text-brand-ink">
                {modal === 'void' ? 'Void Pesanan' : 'Refund Pesanan'} · {detail.number}
              </h3>
              <p className="mt-0.5 text-xs text-brand-ink-3">
                {modal === 'void'
                  ? 'Void hanya bisa dilakukan pada pesanan terbuka — tidak akan membalik jurnal karena belum diposting.'
                  : 'Refund membalik jurnal asli, mengembalikan stok bahan baku, dan menandai pesanan sebagai refunded.'}
              </p>
            </div>
            <div className="space-y-3 p-5">
              {modal === 'refund' && detail ? (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-brand-ink-2">
                    Item & Qty Refund
                  </span>
                  <div className="mt-1 rounded-md border border-brand-cream-3">
                    <table className="w-full text-xs">
                      <thead className="bg-brand-cream-1 text-left uppercase tracking-wider text-brand-ink-3">
                        <tr>
                          <th className="px-2.5 py-1.5">Produk</th>
                          <th className="px-2.5 py-1.5 text-right">Asli</th>
                          <th className="w-20 px-2.5 py-1.5 text-right">Refund</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-cream-3">
                        {detail.lines.map((l) => {
                          const maxQty = Math.round(Number(l.qty));
                          const currentQty = refundLines.get(l.id) ?? 0;
                          return (
                            <tr key={l.id}>
                              <td className="px-2.5 py-1.5 text-brand-ink">{l.productName}</td>
                              <td className="px-2.5 py-1.5 text-right tabular-nums text-brand-ink-2">
                                {formatQty(l.qty)}
                              </td>
                              <td className="px-2.5 py-1.5 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  max={maxQty}
                                  value={currentQty}
                                  onChange={(e) => {
                                    const v = Math.max(
                                      0,
                                      Math.min(maxQty, Number(e.target.value) || 0),
                                    );
                                    setRefundLines((prev) => {
                                      const next = new Map(prev);
                                      next.set(l.id, v);
                                      return next;
                                    });
                                  }}
                                  className="w-16 rounded border border-brand-cream-3 bg-card px-2 py-1 text-right text-xs tabular-nums text-brand-ink focus:border-brand-red focus:outline-none"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1.5 text-right text-xs font-medium text-brand-ink">
                    Est. refund:{' '}
                    <span className="tabular-nums">
                      {formatRupiah(
                        detail.lines.reduce((sum, l) => {
                          const maxQty = Math.round(Number(l.qty));
                          const refQty = refundLines.get(l.id) ?? 0;
                          if (refQty <= 0 || maxQty <= 0) return sum;
                          return sum + (Number(l.lineTotal) / maxQty) * refQty;
                        }, 0),
                      )}
                    </span>
                  </p>
                </div>
              ) : null}

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-brand-ink-2">
                  Alasan
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={255}
                  placeholder={
                    modal === 'void'
                      ? 'mis. pelanggan batal pesan'
                      : 'mis. minuman tumpah, salah produk, dsb.'
                  }
                  className="mt-1 w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
                  autoFocus={modal === 'void'}
                />
                <p className="mt-0.5 text-[11px] text-brand-ink-3">
                  Alasan akan disimpan di audit log dan tidak bisa diubah.
                </p>
              </label>
              {error ? <p className="text-xs text-rose-600">{error}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-brand-cream-3 p-5">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={submitting}
                className="h-10 rounded-md border border-brand-cream-3 text-sm font-medium text-brand-ink-2 hover:bg-brand-cream-2 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitModal}
                disabled={submitting}
                className={`h-10 rounded-md text-sm font-semibold text-white disabled:opacity-50 ${
                  modal === 'void'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-brand-red hover:bg-brand-red-dark'
                }`}
              >
                {submitting
                  ? 'Memproses…'
                  : modal === 'void'
                    ? 'Konfirmasi Void'
                    : 'Konfirmasi Refund'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between ${bold ? 'border-t border-dashed border-brand-cream-3 pt-1 font-semibold text-brand-ink' : ''}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
