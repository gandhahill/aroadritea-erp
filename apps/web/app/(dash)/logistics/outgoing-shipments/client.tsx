'use client';

import { useState } from 'react';
import { syncTrackingAction } from './actions';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export function ShipmentsClient({ shipments }: { shipments: any[] }) {
  const t = useTranslations('logistics');
  const tDetail = useTranslations('logistics.outgoingShipment.detail');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async (id: string, courier: string, awb: string) => {
    try {
      setSyncingId(id);
      setError(null);
      await syncTrackingAction(id, courier, awb);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-brand-cream-3 bg-white shadow-sm overflow-hidden">
      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm border-b border-red-100">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-brand-ink-2">
          <thead className="bg-brand-cream/50 text-xs uppercase text-brand-ink-3">
            <tr>
              <th className="px-6 py-4 font-semibold">{t('number')}</th>
              <th className="px-6 py-4 font-semibold">{t('subject')}</th>
              <th className="px-6 py-4 font-semibold">{t('recipient')}</th>
              <th className="px-6 py-4 font-semibold">{t('courier')}</th>
              <th className="px-6 py-4 font-semibold">{t('status')}</th>
              <th className="px-6 py-4 font-semibold text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-2">
            {shipments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-brand-ink-3">
                  {t('noShipments')}
                </td>
              </tr>
            ) : (
              shipments.map((s) => (
                <tr key={s.id} className="hover:bg-brand-cream/30 transition-colors">
                <td className="px-6 py-4 font-mono text-xs font-semibold text-brand-red hover:underline">
                    <Link href={`/logistics/outgoing-shipments/${s.id}`}>{s.number}</Link>
                  </td>
                  <td className="px-6 py-4">{s.subject}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{s.recipientName}</p>
                    <p className="text-xs text-brand-ink-3 truncate max-w-[200px]">{s.recipientAddress}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{s.shippingCourierCode || '-'}</p>
                    <p className="text-xs text-brand-ink-3 font-mono">{s.shippingAwb || tDetail('noAwb')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-md bg-brand-cream-2 px-2 py-1 text-xs font-medium text-brand-ink">
                      {s.shippingTrackingStatus || s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {s.shippingCourierCode && s.shippingAwb && (
                      <button
                        onClick={() => handleSync(s.id, s.shippingCourierCode, s.shippingAwb)}
                        disabled={syncingId === s.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-brand-red/10 px-3 py-1.5 text-xs font-medium text-brand-red transition-colors hover:bg-brand-red/20 disabled:opacity-50"
                      >
                        {syncingId === s.id ? t('syncing') : t('sync')}
                      </button>
                    )}
                    <Link
                      href={`/logistics/outgoing-shipments/${s.id}`}
                      className="ml-2 text-xs font-semibold text-brand-red hover:underline"
                    >
                      Detail →
                    </Link>
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
