'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-brand-cream-2', text: 'text-brand-ink-2', label: 'Draf' },
  in_progress: { bg: 'bg-brand-gold/10', text: 'text-brand-gold', label: 'Sedang Berlangsung' },
  submitted: { bg: 'bg-brand-gold/20', text: 'text-brand-gold', label: 'Diajukan' },
  approved: { bg: 'bg-brand-jade/10', text: 'text-brand-jade', label: 'Disetujui' },
  cancelled: { bg: 'bg-rose-50', text: 'text-rose-500', label: 'Dibatalkan' },
};

const KIND_LABEL: Record<string, string> = {
  daily: 'Harian',
  monthly: 'Bulanan',
};

interface Row {
  id: string;
  number: string;
  sessionDate: string;
  periodCode: string;
  status: string;
  kind: string;
  preparedBy: string | null;
}

export function OpnameListClient({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (kind && r.kind !== kind) return false;
      if (from && r.sessionDate < from) return false;
      if (to && r.sessionDate > to) return false;
      if (!ql) return true;
      return (
        r.number.toLowerCase().includes(ql) ||
        r.periodCode.toLowerCase().includes(ql) ||
        (r.preparedBy ?? '').toLowerCase().includes(ql)
      );
    });
  }, [rows, q, status, kind, from, to]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-cream-3 bg-card p-3">
        <input
          type="search"
          placeholder="Cari nomor, periode, atau penyiap…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 min-w-48 flex-1 rounded-md border border-brand-cream-3 bg-card px-3 text-sm"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="h-9 rounded-md border border-brand-cream-3 bg-card px-2 text-sm"
        >
          <option value="">Semua jenis</option>
          <option value="daily">Harian</option>
          <option value="monthly">Bulanan</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-brand-cream-3 bg-card px-2 text-sm"
        >
          <option value="">Semua status</option>
          {Object.entries(STATUS_COLORS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 rounded-md border border-brand-cream-3 bg-card px-2 text-sm"
        />
        <span className="text-xs text-brand-ink-3">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 rounded-md border border-brand-cream-3 bg-card px-2 text-sm"
        />
        <span className="ml-auto text-xs text-brand-ink-3">
          {filtered.length} dari {rows.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-cream-3 bg-brand-cream-1">
              <th className="px-4 py-3 text-left font-medium text-brand-ink-2">No. Sesi</th>
              <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Jenis</th>
              <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Tanggal</th>
              <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Periode</th>
              <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Status</th>
              <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Dibuat oleh</th>
              <th className="px-4 py-3 text-right font-medium text-brand-ink-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-2">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-brand-ink-3">
                  {rows.length === 0
                    ? 'Belum ada sesi opname.'
                    : 'Tidak ada sesi yang cocok dengan filter.'}
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const s = STATUS_COLORS[row.status] ?? {
                  bg: 'bg-brand-cream-2',
                  text: 'text-brand-ink-2',
                  label: row.status,
                };
                return (
                  <tr key={row.id} className="hover:bg-brand-cream-1/50">
                    <td className="px-4 py-3 font-medium text-brand-ink">{row.number}</td>
                    <td className="px-4 py-3 text-brand-ink-2">
                      <span className="rounded-full bg-brand-cream-2 px-2 py-0.5 text-xs">
                        {KIND_LABEL[row.kind] ?? row.kind}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-ink-2">{row.sessionDate}</td>
                    <td className="px-4 py-3 text-brand-ink-2">{row.periodCode}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-ink-2">{row.preparedBy ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/inventory/opname/${row.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand-ember-5 hover:text-brand-ember-6"
                      >
                        Lihat →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
