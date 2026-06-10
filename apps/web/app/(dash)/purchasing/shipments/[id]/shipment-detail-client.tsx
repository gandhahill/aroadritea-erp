'use client';

import { COURIERS } from '@erp/shared/binderbyte-couriers';
import { Input, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { syncPurchaseShipmentAction } from '../../actions';
import type { ShipmentDetail } from '../../actions';

function pickString(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const v = record[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

export function ShipmentDetailClient({ detail }: { detail: ShipmentDetail }) {
  const t = useTranslations('purchasing.shipments');
  const tBase = useTranslations('purchasing');

  const summary = detail.summary;
  const history = detail.history;

  const courierName = pickString(summary, 'courier') ?? detail.courierCode ?? '—';
  const service = pickString(summary, 'service');
  const status = pickString(summary, 'status') ?? detail.trackingStatus ?? '—';
  const lastUpdate =
    pickString(summary, 'date') ??
    (detail.trackingSyncedAt ? detail.trackingSyncedAt.slice(0, 16).replace('T', ' ') : null);

  return (
    <>
      <div className="rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{t('detail.metaTitle')}</h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label={tBase('shipmentTracking') + ' / Courier'} value={courierName} />
          <Field label={tBase('awb')} value={detail.awb ?? '—'} mono />
          <Field label={t('detail.service')} value={service ?? '—'} />
          <Field label={t('detail.lastStatus')} value={status} />
          <Field
            label={t('syncedAt')}
            value={detail.trackingSyncedAt?.slice(0, 16).replace('T', ' ') ?? '—'}
          />
          <Field label={t('detail.lastUpdate')} value={lastUpdate ?? '—'} />
        </dl>

        {detail.trackingError ? (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="font-semibold">{t('detail.errorLabel')}: </span>
            {detail.trackingError}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{t('detail.syncTitle')}</h2>
        <p className="mt-1 text-sm text-brand-ink-3">{t('detail.syncHint')}</p>
        <form
          action={async (formData) => {
            await syncPurchaseShipmentAction(formData);
          }}
          className="mt-4 grid gap-3 md:grid-cols-[10rem_1fr_auto]"
        >
          <input type="hidden" name="poId" value={detail.poId} />
          <div>
            <label className="text-xs font-semibold text-brand-ink-3">{t('courier')}</label>
            <Select
              name="courierCode"
              defaultValue={detail.courierCode ?? 'jne'}
              className="w-full"
            >
              {COURIERS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-ink-3">{tBase('awb')}</label>
            <Input name="awb" defaultValue={detail.awb ?? ''} placeholder="0123456789" />
          </div>
          <button
            type="submit"
            className="self-end rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-brand-red-dark"
          >
            {tBase('syncTracking')}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{t('detail.historyTitle')}</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-brand-ink-3">{t('detail.historyEmpty')}</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {history.map((event, idx) => {
              const date = pickString(event, 'date');
              const desc = pickString(event, 'desc') ?? pickString(event, 'description');
              const location = pickString(event, 'location') ?? pickString(event, 'city');
              return (
                <li
                  key={`${idx}-${date ?? ''}`}
                  className="rounded-lg border border-brand-cream-3 bg-brand-paper p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-mono text-brand-ink-3">{date ?? '—'}</p>
                    {location ? (
                      <p className="text-xs font-semibold text-brand-muted">{location}</p>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-brand-ink">{desc ?? '—'}</p>
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
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-brand-ink-3">{label}</dt>
      <dd className={`mt-1 text-sm text-brand-ink ${mono ? 'font-mono' : 'font-medium'}`}>
        {value}
      </dd>
    </div>
  );
}
