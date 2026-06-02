'use client';

import { useState } from 'react';
import { deleteOutgoingShipmentAction, syncTrackingAction } from './actions';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { COURIERS } from '@erp/shared/binderbyte-couriers';
import { toast } from '@erp/ui';

function courierLabel(code: string | null | undefined): string {
  if (!code) return '-';
  return COURIERS.find((courier) => courier.code === code)?.name ?? code;
}

export function ShipmentsClient({ shipments }: { shipments: any[] }) {
  const t = useTranslations('logistics');
  const tDetail = useTranslations('logistics.outgoingShipment.detail');
  const tShipment = useTranslations('logistics.outgoingShipment');
  const router = useRouter();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async (id: string, courier: string, awb: string) => {
    try {
      setSyncingId(id);
      setError(null);
      await syncTrackingAction(id, courier, awb);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(tShipment('confirmDelete'))) return;
    try {
      setDeletingId(id);
      setError(null);
      await deleteOutgoingShipmentAction(id);
      toast.success(tShipment('successDeleted'));
      router.refresh();
    } catch (e: any) {
      const message = e.message || tShipment('deleteFailed');
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
      {error ? (
        <div className="border-b border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-brand-ink-2">
          <thead className="bg-brand-cream/50 text-xs uppercase text-brand-ink-3">
            <tr>
              <th className="px-6 py-4 font-semibold">{t('number')}</th>
              <th className="px-6 py-4 font-semibold">{t('subject')}</th>
              <th className="px-6 py-4 font-semibold">{t('recipient')}</th>
              <th className="px-6 py-4 font-semibold">{t('courier')}</th>
              <th className="px-6 py-4 font-semibold">{t('status')}</th>
              <th className="px-6 py-4 text-right font-semibold">{t('actions')}</th>
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
              shipments.map((shipment) => (
                <tr key={shipment.id} className="transition-colors hover:bg-brand-cream/30">
                  <td className="px-6 py-4 font-mono text-xs font-semibold text-brand-red hover:underline">
                    <Link href={`/logistics/outgoing-shipments/${shipment.id}`}>
                      {shipment.number}
                    </Link>
                  </td>
                  <td className="px-6 py-4">{shipment.subject}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{shipment.recipientName}</p>
                    <p className="max-w-[200px] truncate text-xs text-brand-ink-3">
                      {shipment.recipientAddress}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{courierLabel(shipment.shippingCourierCode)}</p>
                    <p className="font-mono text-xs text-brand-ink-3">
                      {shipment.shippingAwb || tDetail('noAwb')}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-md bg-brand-cream-2 px-2 py-1 text-xs font-medium text-brand-ink">
                      {shipment.shippingTrackingStatus || shipment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {shipment.shippingCourierCode && shipment.shippingAwb ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleSync(
                              shipment.id,
                              shipment.shippingCourierCode,
                              shipment.shippingAwb,
                            )
                          }
                          disabled={syncingId === shipment.id}
                          className="inline-flex items-center gap-1.5 rounded-md bg-brand-red/10 px-3 py-1.5 text-xs font-medium text-brand-red transition-colors hover:bg-brand-red/20 disabled:opacity-50"
                        >
                          {syncingId === shipment.id ? t('syncing') : t('sync')}
                        </button>
                      ) : null}
                      <Link
                        href={`/logistics/outgoing-shipments/${shipment.id}`}
                        className="rounded-md border border-brand-cream-3 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-cream"
                      >
                        {t('detailLink')}
                      </Link>
                      <Link
                        href={`/logistics/outgoing-shipments/${shipment.id}/edit`}
                        className="rounded-md border border-brand-cream-3 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-cream"
                      >
                        {t('edit')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(shipment.id)}
                        disabled={deletingId === shipment.id}
                        className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {deletingId === shipment.id ? t('deleting') : t('delete')}
                      </button>
                    </div>
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
