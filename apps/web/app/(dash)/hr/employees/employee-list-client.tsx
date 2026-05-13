/**
 * Employee List Client Component — interactive search, filter, pagination.
 * Used by the server-rendered employee list page.
 */

'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

interface EmployeeRow {
  id: string;
  nik: string;
  name: string;
  email: string;
  status: string;
  statusLabel: string;
  statusColor: { bg: string; text: string };
  position: string;
  department: string | null;
  hireDate: string;
  contractLabel: string;
  contractType: string;
}

interface Props {
  rows: EmployeeRow[];
  total: number;
  page: number;
  totalPages: number;
  initialQ: string;
  initialStatus: string;
  statusOptions: { value: string; label: string }[];
}

export function EmployeeListClient({
  rows,
  total,
  page,
  totalPages,
  initialQ,
  initialStatus,
  statusOptions,
}: Props) {
  const t = useTranslations('hr.employees');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(initialQ);

  const applyFilter = (newQ: string, newStatus: string, newPage: number) => {
    const params = new URLSearchParams();
    if (newQ) params.set('q', newQ);
    if (newStatus) params.set('status', newStatus);
    if (newPage > 1) params.set('page', String(newPage));
    startTransition(() => {
      router.push(`/hr/employees${params.size > 0 ? '?' + params.toString() : ''}`);
    });
  };

  return (
    <div className="space-y-4">
      {/* Search + Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyFilter(q, initialStatus, 1);
            }}
            placeholder={t('name')}
            className="w-full rounded-lg border border-brand-cream-3 bg-card pl-10 pr-4 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-ember-5 focus:outline-none focus:ring-2 focus:ring-brand-ember-5/20"
          />
        </div>

        <select
          value={initialStatus}
          onChange={(e) => applyFilter(q, e.target.value, 1)}
          className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none focus:ring-2 focus:ring-brand-ember-5/20"
        >
          <option value="">{t('status')}</option>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
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
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
            />
          </svg>
          <h3 className="mt-3 text-base font-semibold text-brand-ink">No employees found</h3>
          <p className="mt-1 text-sm text-brand-ink-3">{t('noData')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-cream-3 bg-brand-cream-1">
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">{t('name')}</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">{t('nik')}</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">
                  {t('position')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">
                  {t('department')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">{t('status')}</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">
                  {t('contractType')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">
                  {t('hireDate')}
                </th>
                <th className="px-4 py-3 text-right font-medium text-brand-ink-2">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-2">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-brand-cream-1/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-ember-5/10 text-xs font-semibold text-brand-ember-5">
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-brand-ink">{row.name}</div>
                        <div className="text-xs text-brand-ink-3">{row.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-ink-2">{row.nik}</td>
                  <td className="px-4 py-3 text-brand-ink">{row.position}</td>
                  <td className="px-4 py-3 text-brand-ink-2">{row.department ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${row.statusColor.bg} ${row.statusColor.text}`}
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-brand-ink-2">{row.contractLabel}</td>
                  <td className="px-4 py-3 text-brand-ink-2">
                    {row.hireDate ? new Date(row.hireDate).toLocaleDateString('id-ID') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/hr/employees/${row.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand-ember-5 transition-colors hover:text-brand-ember-6"
                    >
                      View
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-brand-ink-3">
            Page {page} of {totalPages} — {total} results
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyFilter(q, initialStatus, page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-brand-cream-3 px-3 py-1.5 text-sm text-brand-ink disabled:cursor-not-allowed disabled:opacity-40 hover:bg-brand-cream-1"
            >
              Prev
            </button>
            <button
              onClick={() => applyFilter(q, initialStatus, page + 1)}
              disabled={page >= totalPages}
              className="rounded-lg border border-brand-cream-3 px-3 py-1.5 text-sm text-brand-ink disabled:cursor-not-allowed disabled:opacity-40 hover:bg-brand-cream-1"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
