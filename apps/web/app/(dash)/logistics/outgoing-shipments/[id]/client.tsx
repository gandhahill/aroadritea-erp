'use client';

import { COURIERS } from '@erp/shared/binderbyte-couriers';
import { Button, Input, Select, toast } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { syncTrackingAction } from '../actions';
import type { OutgoingShipmentDetail } from '../actions';

function pickString(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

function courierLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return COURIERS.find((courier) => courier.code === code)?.name ?? code;
}

export function OutgoingShipmentDetailClient({ detail }: { detail: OutgoingShipmentDetail }) {
  const t = useTranslations('logistics.outgoingShipment.detail');
  const tShipment = useTranslations('logistics.outgoingShipment');
  const tCommon = useTranslations('common.actions');
  const router = useRouter();

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const summary = detail.trackingSummary;
  const history = detail.trackingHistory;

  const courierName = pickString(summary, 'courier') ?? courierLabel(detail.courierCode) ?? '-';
  const service = pickString(summary, 'service');
  const status = pickString(summary, 'status') ?? detail.trackingStatus ?? '-';
  const lastUpdate =
    pickString(summary, 'date') ??
    (detail.trackingSyncedAt ? detail.trackingSyncedAt.slice(0, 16).replace('T', ' ') : null);

  const handleSync = async (formData: FormData) => {
    setSyncing(true);
    setSyncError(null);
    try {
      const courierCode = formData.get('courierCode') as string;
      const awb = formData.get('awb') as string;
      await syncTrackingAction(detail.id, courierCode, awb);
      toast.success(tCommon('success'));
      router.refresh();
    } catch (e: any) {
      setSyncError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{t('recipientTitle')}</h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label={tShipment('recipientName')} value={detail.recipientName} />
          <Field label={tShipment('recipientPhone')} value={detail.recipientPhone ?? '-'} />
          <Field label={tShipment('recipientAddress')} value={detail.recipientAddress} span2 />
          {detail.notes ? <Field label={tShipment('subject')} value={detail.notes} span2 /> : null}
        </dl>
      </div>

      <div className="rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{t('metaTitle')}</h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label={tShipment('courierCode')} value={courierName} />
          <Field label={tShipment('awb')} value={detail.awb ?? t('noAwb')} mono />
          <Field label={t('service')} value={service ?? '-'} />
          <Field label={t('lastStatus')} value={status} />
          <Field label={t('lastUpdate')} value={lastUpdate ?? '-'} />
          <Field
            label={t('syncedAt')}
            value={
              detail.trackingSyncedAt ? detail.trackingSyncedAt.slice(0, 16).replace('T', ' ') : '-'
            }
          />
        </dl>

        {detail.trackingError ? (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="font-semibold">{t('errorLabel')}: </span>
            {detail.trackingError}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{t('syncTitle')}</h2>
        <p className="mt-1 text-sm text-brand-ink-3">{t('syncHint')}</p>

        {syncError ? (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {syncError}
          </div>
        ) : null}

        <form action={handleSync} className="mt-4 grid gap-3 md:grid-cols-[10rem_1fr_8rem]">
          <div>
            <label className="text-xs font-semibold text-brand-ink-3">
              {tShipment('courierCode')}
            </label>
            <Select name="courierCode" defaultValue={detail.courierCode ?? ''} className="w-full">
              <option value="">{tShipment('selectCourier')}</option>
              {COURIERS.map((courier) => (
                <option key={courier.code} value={courier.code}>
                  {courier.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-ink-3">{tShipment('awb')}</label>
            <Input
              name="awb"
              defaultValue={detail.awb ?? ''}
              placeholder={tShipment('awbPlaceholder')}
            />
          </div>
          <div>
            <span className="block text-xs font-semibold text-brand-ink-3 opacity-0">
              {t('track')}
            </span>
            <Button
              type="submit"
              disabled={syncing}
              variant="primary"
              size="md"
              className="w-full rounded-lg"
            >
              {syncing ? t('tracking') : t('track')}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{t('historyTitle')}</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-brand-ink-3">{t('historyEmpty')}</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {history.map((event, index) => {
              const date = pickString(event, 'date');
              const desc = pickString(event, 'desc') ?? pickString(event, 'description');
              const location = pickString(event, 'location') ?? pickString(event, 'city');
              return (
                <li
                  key={`${index}-${date ?? ''}`}
                  className="rounded-lg border border-brand-cream-3 bg-brand-paper p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-mono text-brand-ink-3">{date ?? '-'}</p>
                    {location ? (
                      <p className="text-xs font-semibold text-brand-muted">{location}</p>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-brand-ink">{desc ?? '-'}</p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </>
  );
}

function Field({
  label,
  value,
  mono = false,
  span2 = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? 'md:col-span-2' : ''}>
      <dt className="text-xs uppercase tracking-wider text-brand-ink-3">{label}</dt>
      <dd className={`mt-1 text-sm text-brand-ink ${mono ? 'font-mono' : 'font-medium'}`}>
        {value}
      </dd>
    </div>
  );
}
