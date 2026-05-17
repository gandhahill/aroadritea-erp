/**
 * Attendance List Client Component — interactive filters + table.
 */

'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { forgiveLateAction } from './actions';

interface AttendanceRow {
  id: string;
  employeeId: string;
  employeeName: string;
  shiftCode: string | null;
  checkInAt: string;
  checkOutAt: string | null;
  checkInMethod: string;
  isLate: boolean;
  lateMinutes: number;
  workedMinutes: number | null;
  lateForgiven?: boolean;
  lateForgivenReason?: string | null;
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMinutes(min: number | null): string {
  if (min === null || min === undefined) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface Props {
  items: AttendanceRow[];
  total: number;
  page: number;
  totalPages: number;
  initialEmployeeId: string;
  initialDateFrom: string;
  initialDateTo: string;
  employees: { value: string; label: string }[];
}

export function AttendanceListClient({
  items,
  total,
  page,
  totalPages,
  initialEmployeeId,
  initialDateFrom,
  initialDateTo,
  employees,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [forgiveId, setForgiveId] = useState<string | null>(null);
  const [forgiveReason, setForgiveReason] = useState('');
  const [forgiveErr, setForgiveErr] = useState<string | null>(null);
  const [forgiving, setForgiving] = useState(false);

  async function submitForgive() {
    if (!forgiveId) return;
    if (forgiveReason.trim().length < 3) {
      setForgiveErr('Alasan minimal 3 karakter.');
      return;
    }
    setForgiving(true);
    setForgiveErr(null);
    const res = await forgiveLateAction(forgiveId, forgiveReason.trim());
    setForgiving(false);
    if (!res.ok) {
      setForgiveErr(res.error ?? 'Gagal memberi dispensasi keterlambatan.');
      return;
    }
    setForgiveId(null);
    setForgiveReason('');
    router.refresh();
  }

  const applyFilter = (opts: {
    employeeId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    if (opts.employeeId) params.set('employeeId', opts.employeeId);
    if (opts.dateFrom) params.set('dateFrom', opts.dateFrom);
    if (opts.dateTo) params.set('dateTo', opts.dateTo);
    if ((opts.page ?? 1) > 1) params.set('page', String(opts.page));
    startTransition(() => {
      router.push(`/hr/attendance${params.size > 0 ? '?' + params.toString() : ''}`);
    });
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-cream-3 bg-card p-4">
        <select
          value={initialEmployeeId}
          onChange={(e) =>
            applyFilter({
              employeeId: e.target.value,
              dateFrom: initialDateFrom,
              dateTo: initialDateTo,
              page: 1,
            })
          }
          className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none focus:ring-2 focus:ring-brand-ember-5/20"
        >
          <option value="">Semua Karyawan</option>
          {employees.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 text-sm text-brand-ink-3">
          <span>Dari</span>
          <input
            type="date"
            value={initialDateFrom}
            onChange={(e) =>
              applyFilter({
                employeeId: initialEmployeeId,
                dateFrom: e.target.value,
                dateTo: initialDateTo,
                page: 1,
              })
            }
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none focus:ring-2 focus:ring-brand-ember-5/20"
          />
          <span>Sampai</span>
          <input
            type="date"
            value={initialDateTo}
            onChange={(e) =>
              applyFilter({
                employeeId: initialEmployeeId,
                dateFrom: initialDateFrom,
                dateTo: e.target.value,
                page: 1,
              })
            }
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none focus:ring-2 focus:ring-brand-ember-5/20"
          />
        </div>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-brand-cream-3 bg-card py-16 text-center">
          <svg
            className="h-12 w-12 text-brand-cream-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          <h3 className="mt-3 text-base font-semibold text-brand-ink">Belum ada presensi</h3>
          <p className="mt-1 text-sm text-brand-ink-3">Riwayat clock-in/out akan tampil di sini.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-cream-3 bg-brand-cream-1">
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Karyawan</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Shift</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Masuk</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Pulang</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Metode</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Telat</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Jam kerja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-2">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-brand-cream-1/50">
                  <td className="px-4 py-3 font-medium text-brand-ink">{row.employeeName}</td>
                  <td className="px-4 py-3 text-brand-ink-2">{row.shiftCode ?? '—'}</td>
                  <td className="px-4 py-3 text-brand-ink-2">{formatDateTime(row.checkInAt)}</td>
                  <td className="px-4 py-3 text-brand-ink-2">
                    {formatDateTime(row.checkOutAt ?? '')}
                  </td>
                  <td className="px-4 py-3 text-brand-ink-2 capitalize">
                    {row.checkInMethod === 'gps' ? 'GPS' : row.checkInMethod}
                  </td>
                  <td className="px-4 py-3">
                    {row.isLate ? (
                      row.lateForgiven ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-jade/10 px-2.5 py-0.5 text-xs font-medium text-brand-jade"
                          title={row.lateForgivenReason ?? ''}
                        >
                          +{row.lateMinutes}m (dispensasi)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-500">
                          +{row.lateMinutes}m
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-brand-jade">Tepat Waktu</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-brand-ink-2">{formatMinutes(row.workedMinutes)}</td>
                  <td className="px-4 py-3">
                    {row.isLate && !row.lateForgiven ? (
                      <button
                        type="button"
                        onClick={() => {
                          setForgiveId(row.id);
                          setForgiveReason('');
                          setForgiveErr(null);
                        }}
                        className="rounded-md border border-brand-cream-3 px-2.5 py-1 text-xs font-semibold text-brand-ink-2 hover:border-brand-jade/40 hover:text-brand-jade"
                      >
                        Dispensasi
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {forgiveId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold text-brand-ink">Beri dispensasi keterlambatan</h3>
            <p className="mt-1 text-sm text-brand-ink-3">
              Catat alasan agar audit trail jelas. Setelah dispensasi, kejadian
              ini tidak dihitung untuk denda payroll.
            </p>
            <textarea
              value={forgiveReason}
              onChange={(event) => setForgiveReason(event.target.value)}
              placeholder="Mis. shift dimajukan dadakan oleh manajer."
              className="mt-3 h-24 w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
            />
            {forgiveErr ? (
              <p className="mt-1 text-xs text-rose-600">{forgiveErr}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setForgiveId(null)}
                className="rounded-md border border-brand-cream-3 px-3 py-2 text-sm font-semibold text-brand-ink-3 hover:bg-brand-cream-1"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitForgive}
                disabled={forgiving}
                className="rounded-md bg-brand-red px-3 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
              >
                {forgiving ? 'Menyimpan...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-brand-ink-3">
            Halaman {page} dari {totalPages} — {total} entri
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyFilter({ page: page - 1 })}
              disabled={page <= 1}
              className="rounded-lg border border-brand-cream-3 px-3 py-1.5 text-sm text-brand-ink disabled:cursor-not-allowed disabled:opacity-40 hover:bg-brand-cream-1"
            >
              ← Sebelumnya
            </button>
            <button
              onClick={() => applyFilter({ page: page + 1 })}
              disabled={page >= totalPages}
              className="rounded-lg border border-brand-cream-3 px-3 py-1.5 text-sm text-brand-ink disabled:cursor-not-allowed disabled:opacity-40 hover:bg-brand-cream-1"
            >
              Berikutnya →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
