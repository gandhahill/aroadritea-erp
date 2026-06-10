/**
 * My Leave — self-service leave requests.
 *
 * Any authenticated employee can submit their own leave request and view
 * the status of their submissions. No HR permission is required (unlike
 * the management dashboard at /hr/leave).
 */

import { PageHeader } from '@/components/page-header';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { cancelMyLeaveRequestAction, createMyLeaveRequestAction, fetchMyLeave } from './actions';

export const metadata: Metadata = { title: 'Pengajuan Cuti Saya' };

function pickName(name: Record<string, string> | null, locale: string): string {
  if (!name) return '—';
  return name[locale] ?? name.id ?? name.en ?? Object.values(name)[0] ?? '—';
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
  cancelled: 'bg-brand-cream-2 text-brand-ink-3',
};

export default async function MyLeavePage() {
  const locale = await getLocale();
  const t = await getTranslations('hr.myLeave');
  const statusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return t('statusLabel.pending');
      case 'approved':
        return t('statusLabel.approved');
      case 'rejected':
        return t('statusLabel.rejected');
      case 'cancelled':
        return t('statusLabel.cancelled');
      default:
        return status;
    }
  };
  const data = await fetchMyLeave();

  if (!data) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {t('notLinked')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} eyebrow={<>HR</>} />

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-brand-ink">{t('newRequest')}</h2>
        <form action={createMyLeaveRequestAction} className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-brand-ink">{t('leaveType')}</span>
            <select
              name="leaveTypeId"
              required
              className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            >
              <option value="">{t('selectLeaveType')}</option>
              {data.activeLeaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.nameId}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{t('startDate')}</span>
            <input
              type="date"
              name="startDate"
              required
              className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{t('endDate')}</span>
            <input
              type="date"
              name="endDate"
              required
              className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            />
          </label>
          <label className="space-y-1.5 md:col-span-4">
            <span className="text-sm font-medium text-brand-ink">{t('reason')}</span>
            <input
              type="text"
              name="reason"
              placeholder={t('reasonPlaceholder')}
              className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
            />
          </label>
          <div className="md:col-span-4">
            <button
              type="submit"
              className="rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark"
            >
              {t('submit')}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <div className="border-b border-brand-cream-3 px-5 py-4">
          <h2 className="text-base font-semibold text-brand-ink">{t('myRequests')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
              <tr>
                <th className="px-4 py-2.5">{t('leaveType')}</th>
                <th className="px-4 py-2.5">{t('period')}</th>
                <th className="px-4 py-2.5 text-right">{t('days')}</th>
                <th className="px-4 py-2.5">{t('reason')}</th>
                <th className="px-4 py-2.5">{t('status')}</th>
                <th className="px-4 py-2.5 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3">
              {data.requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-brand-ink-3">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                data.requests.map((r) => {
                  const start = r.startDate.toLocaleDateString('en-CA', {
                    timeZone: 'Asia/Jakarta',
                  });
                  const end = r.endDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
                  return (
                    <tr key={r.id} className="text-brand-ink">
                      <td className="px-4 py-2.5">{pickName(r.leaveTypeName, locale)}</td>
                      <td className="px-4 py-2.5 text-brand-ink-2">
                        {start} → {end}
                      </td>
                      <td className="px-4 py-2.5 text-right">{r.totalDays}</td>
                      <td className="px-4 py-2.5 text-brand-ink-2">
                        {r.status === 'rejected' && r.rejectReason ? (
                          <span className="text-rose-600">{r.rejectReason}</span>
                        ) : (
                          r.reason || '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[r.status] ?? 'bg-brand-cream-2 text-brand-ink-3'}`}
                        >
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.status === 'pending' ? (
                          <form action={cancelMyLeaveRequestAction} className="inline">
                            <input type="hidden" name="id" value={r.id} />
                            <button
                              type="submit"
                              className="text-xs font-medium text-rose-600 hover:underline"
                            >
                              {t('cancel')}
                            </button>
                          </form>
                        ) : (
                          <span className="text-brand-ink-3">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
