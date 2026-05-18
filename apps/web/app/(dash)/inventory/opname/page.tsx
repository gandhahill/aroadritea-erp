/**
 * Stock Opname List Page — SD §25.9
 *
 * Lists all opname sessions for the tenant/location.
 * Create new session button, status badges, quick actions.
 */

import { getSession } from '@/lib/auth';
import { db } from '@erp/db';
import { and, desc, eq } from '@erp/db';
import { locations, users } from '@erp/db/schema/auth';
import { stockOpnameSessions } from '@erp/db/schema/stock-opname';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Stock Opname' };

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-brand-cream-2', text: 'text-brand-ink-2', label: 'Draf' },
  in_progress: { bg: 'bg-brand-gold/10', text: 'text-brand-gold', label: 'Sedang Berlangsung' },
  submitted: { bg: 'bg-brand-gold/20', text: 'text-brand-gold', label: 'Diajukan' },
  approved: { bg: 'bg-brand-jade/10', text: 'text-brand-jade', label: 'Disetujui' },
  cancelled: { bg: 'bg-rose-50', text: 'text-rose-500', label: 'Dibatalkan' },
};

export default async function OpnameListPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  const locale = (await getLocale().catch(() => 'id')) as 'id' | 'en' | 'zh';

  // Fetch sessions + JOIN users for prepared-by display name + JOIN
  // locations for the localized outlet label. Avoid showing UUIDs in
  // the operator UI. Both joins are tenant-scoped so a stray cross-tenant
  // user row (which should never happen, but defense-in-depth) can't leak
  // a name into the table.
  const rows = await db
    .select({
      id: stockOpnameSessions.id,
      number: stockOpnameSessions.number,
      sessionDate: stockOpnameSessions.sessionDate,
      periodCode: stockOpnameSessions.periodCode,
      status: stockOpnameSessions.status,
      preparedById: stockOpnameSessions.preparedBy,
      preparedByName: users.displayName,
      preparedByEmail: users.email,
      locationId: stockOpnameSessions.locationId,
      locationName: locations.name,
      locationCode: locations.code,
      createdAt: stockOpnameSessions.createdAt,
    })
    .from(stockOpnameSessions)
    .leftJoin(
      users,
      and(eq(users.id, stockOpnameSessions.preparedBy), eq(users.tenantId, tenantId)),
    )
    .leftJoin(
      locations,
      and(eq(locations.id, stockOpnameSessions.locationId), eq(locations.tenantId, tenantId)),
    )
    .where(eq(stockOpnameSessions.tenantId, tenantId))
    .orderBy(desc(stockOpnameSessions.createdAt))
    .limit(50);

  function pickLocationLabel(
    name: Record<string, string> | null,
    code: string | null,
    id: string,
  ): string {
    if (name) return name[locale] ?? name.id ?? name.en ?? name.zh ?? code ?? id;
    return code ?? id;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Stock Opname</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            Kelola sesi stock opname dan penyesuaian inventaris.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/inventory/opname/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-ember-5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ember-6"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Buat Sesi Opname
          </Link>
        </div>
      </div>

      {/* Session list table */}
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
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
            />
          </svg>
          <h3 className="mt-3 text-base font-semibold text-brand-ink">Belum ada sesi opname</h3>
          <p className="mt-1 text-sm text-brand-ink-3">
            Buat sesi pertama untuk memulai stock opname.
          </p>
          <Link
            href="/inventory/opname/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-ember-5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ember-6"
          >
            Buat Sesi Opname
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-cream-3 bg-brand-cream-1">
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">No. Sesi</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Tanggal</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Outlet</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Periode</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Status</th>
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Dibuat oleh</th>
                <th className="px-4 py-3 text-right font-medium text-brand-ink-2">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-2">
              {rows.map((row) => {
                const status = STATUS_COLORS[row.status as string] ?? {
                  bg: 'bg-brand-cream-2',
                  text: 'text-brand-ink-2',
                  label: String(row.status),
                };
                return (
                  <tr key={row.id} className="hover:bg-brand-cream-1/50">
                    <td className="px-4 py-3 font-medium text-brand-ink">{row.number}</td>
                    <td className="px-4 py-3 text-brand-ink-2">{String(row.sessionDate)}</td>
                    <td className="px-4 py-3 text-brand-ink-2">
                      {pickLocationLabel(
                        row.locationName as Record<string, string> | null,
                        row.locationCode,
                        row.locationId,
                      )}
                    </td>
                    <td className="px-4 py-3 text-brand-ink-2">{row.periodCode}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-ink-2">
                      {row.preparedByName ?? row.preparedByEmail ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/inventory/opname/${row.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand-ember-5 transition-colors hover:text-brand-ember-6"
                      >
                        Lihat
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
