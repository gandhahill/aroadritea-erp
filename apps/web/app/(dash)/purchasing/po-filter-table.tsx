'use client';

import { useMemo, useState } from 'react';

interface PoRow {
  id: string;
  number: string;
  supplierName: string;
  locationName: string;
  orderDate: string;
  grandTotal: string;
  status: string;
}

function formatIdr(value: string): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function statusClass(status: string): string {
  if (['approved', 'received', 'closed'].includes(status))
    return 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade';
  if (['submitted', 'partial'].includes(status))
    return 'border-brand-gold/40 bg-brand-gold/15 text-brand-wood';
  if (status === 'cancelled') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-brand-cream-3 bg-brand-cream-1 text-brand-ink-3';
}

export function PoFilterTable({ purchaseOrders }: { purchaseOrders: PoRow[] }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return purchaseOrders.filter((po) => {
      if (status && po.status !== status) return false;
      if (from && po.orderDate < from) return false;
      if (to && po.orderDate > to) return false;
      if (!ql) return true;
      return (
        po.number.toLowerCase().includes(ql) ||
        po.supplierName.toLowerCase().includes(ql) ||
        po.locationName.toLowerCase().includes(ql)
      );
    });
  }, [purchaseOrders, q, status, from, to]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-brand-cream-3 px-5 py-3">
        <input
          type="search"
          placeholder="Cari nomor, supplier, lokasi…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 min-w-40 flex-1 rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-brand-cream-3 bg-card px-2 text-sm"
        >
          <option value="">Semua status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="partial">Partial</option>
          <option value="received">Received</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="Dari tanggal"
          className="h-9 rounded-md border border-brand-cream-3 bg-card px-2 text-sm"
        />
        <span className="text-xs text-brand-ink-3">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Sampai tanggal"
          className="h-9 rounded-md border border-brand-cream-3 bg-card px-2 text-sm"
        />
        <span className="ml-auto text-xs text-brand-ink-3">
          {filtered.length} dari {purchaseOrders.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
          <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
            <tr>
              <th className="px-4 py-3">Nomor</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Lokasi</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3 bg-card">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brand-ink-3">
                  {purchaseOrders.length === 0
                    ? 'Belum ada purchase order.'
                    : 'Tidak ada PO yang cocok dengan filter.'}
                </td>
              </tr>
            ) : (
              filtered.map((po) => (
                <tr key={po.id}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-ink">
                    {po.number}
                  </td>
                  <td className="px-4 py-3 text-brand-ink">{po.supplierName}</td>
                  <td className="px-4 py-3 text-brand-muted">{po.locationName}</td>
                  <td className="px-4 py-3 text-brand-muted">{po.orderDate}</td>
                  <td className="px-4 py-3 text-right font-semibold text-brand-ink">
                    {formatIdr(po.grandTotal)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(po.status)}`}
                    >
                      {po.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
