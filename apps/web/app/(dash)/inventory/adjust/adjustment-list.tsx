'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdjustmentRow } from './actions';
import { approveAdjustmentAction, rejectAdjustmentAction } from './actions';

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-brand-cream-2', text: 'text-brand-ink-2' },
  submitted: { bg: 'bg-amber-50', text: 'text-amber-700' },
  approved: { bg: 'bg-emerald-50', text: 'text-brand-jade' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-600' },
};

const REASON_KEY: Record<string, string> = {
  count_correction: 'reasons.count_correction',
  waste: 'reasons.waste',
  damage: 'reasons.damage',
  opening_balance: 'reasons.opening_balance',
  other: 'reasons.other',
};

export function AdjustmentList({ rows }: { rows: AdjustmentRow[] }) {
  const t = useTranslations('inventory.adjust');
  const tc = useTranslations('common');
  const router = useRouter();
  const [actionTarget, setActionTarget] = useState<AdjustmentRow | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = rows.filter((r) => r.status === 'submitted').length;

  const handleAction = async () => {
    if (!actionTarget || !actionType) return;
    setLoading(true);
    setError(null);

    const result =
      actionType === 'approve'
        ? await approveAdjustmentAction(actionTarget.id, actionTarget.version)
        : await rejectAdjustmentAction(actionTarget.id, actionTarget.version, rejectReason);

    setLoading(false);
    if (result.ok) {
      setActionTarget(null);
      setActionType(null);
      setRejectReason('');
      router.refresh();
    } else {
      setError(result.error ?? t('actionFailed'));
    }
  };

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-ink">{t('listTitle')}</h2>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            {t('pendingCount', { count: pendingCount })}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream-1 text-left text-xs uppercase tracking-widest text-brand-ink-3">
            <tr>
              <th className="px-4 py-3">{t('colNumber')}</th>
              <th className="px-4 py-3">{t('colDate')}</th>
              <th className="px-4 py-3">{t('colLocation')}</th>
              <th className="px-4 py-3">{t('colReason')}</th>
              <th className="px-4 py-3">{t('colLines')}</th>
              <th className="px-4 py-3">{t('colCreatedBy')}</th>
              <th className="px-4 py-3">{t('colStatus')}</th>
              <th className="px-4 py-3 text-right">{tc('labels.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3">
            {rows.map((row) => {
              const style = STATUS_STYLE[row.status] ?? STATUS_STYLE.draft;
              return (
                <tr key={row.id} className="hover:bg-brand-cream-1/50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-ink">
                    <span className="rounded bg-brand-cream-1 px-2 py-0.5 font-mono text-xs">
                      {row.number}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-brand-ink-2">
                    {row.adjustmentDate}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-brand-ink-2">
                    {row.locationName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-brand-ink-2">
                    {t(REASON_KEY[row.reason] ?? 'reasons.other')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-brand-ink-2 text-center">
                    {row.lineCount}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-brand-ink-2">
                    {row.createdByName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style?.bg ?? ''} ${style?.text ?? ''}`}
                    >
                      {t(`status.${row.status}`)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {row.status === 'submitted' && (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActionTarget(row);
                            setActionType('approve');
                            setError(null);
                          }}
                          className="text-xs font-semibold text-brand-jade hover:text-brand-jade/80"
                        >
                          {t('approve')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionTarget(row);
                            setActionType('reject');
                            setRejectReason('');
                            setError(null);
                          }}
                          className="text-xs font-semibold text-rose-500 hover:text-rose-700"
                        >
                          {t('reject')}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Approve / Reject dialog */}
      {actionTarget && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="close"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !loading && setActionTarget(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-card shadow-2xl overflow-hidden">
            <div className="border-b border-brand-cream-3 px-6 py-4 bg-brand-cream">
              <h3 className="text-lg font-semibold text-brand-ink">
                {actionType === 'approve' ? t('approveTitle') : t('rejectTitle')}
              </h3>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-brand-ink-2">
                {actionType === 'approve'
                  ? t('approveBody', { number: actionTarget.number })
                  : t('rejectBody', { number: actionTarget.number })}
              </p>
              {actionTarget.notes && (
                <p className="rounded-lg bg-brand-cream-1 px-3 py-2 text-xs text-brand-ink-3">
                  {actionTarget.notes}
                </p>
              )}
              {actionType === 'reject' && (
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('rejectReasonPlaceholder')}
                  className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                  rows={3}
                />
              )}
              {error && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {error}
                </p>
              )}
            </div>
            <div className="border-t border-brand-cream-3 p-4 bg-brand-cream flex justify-end gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => setActionTarget(null)}
                className="rounded-lg border border-brand-cream-3 px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-cream-2 disabled:opacity-50"
              >
                {tc('actions.cancel')}
              </button>
              <button
                type="button"
                disabled={loading || (actionType === 'reject' && !rejectReason.trim())}
                onClick={handleAction}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  actionType === 'approve'
                    ? 'bg-brand-jade hover:bg-brand-jade/90'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {loading
                  ? tc('actions.processing')
                  : actionType === 'approve'
                    ? t('approve')
                    : t('reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
