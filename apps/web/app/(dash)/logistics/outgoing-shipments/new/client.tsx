'use client';

import { pickLocalized } from '@/lib/pick-localized';
import { COURIERS } from '@erp/shared/binderbyte-couriers';
import { Button, Select, toast } from '@erp/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createOutgoingShipmentAction, updateOutgoingShipmentAction } from '../actions';

interface OutgoingShipmentFormProps {
  locations: any[];
  partners?: any[];
  mode?: 'create' | 'edit';
  initialData?: {
    id: string;
    number: string;
    locationId: string;
    subject: string;
    notes: string | null;
    recipientName: string;
    recipientAddress: string;
    recipientPhone: string | null;
    courierCode: string | null;
    awb: string | null;
    phoneLast5: string | null;
  };
}

export function OutgoingShipmentForm({
  locations,
  partners = [],
  mode = 'create',
  initialData,
}: OutgoingShipmentFormProps) {
  const router = useRouter();
  const t = useTranslations('logistics.outgoingShipment');
  const tCommon = useTranslations('common.actions');
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    number: initialData?.number ?? `OSH-${Date.now()}`,
    locationId: initialData?.locationId ?? locations[0]?.id ?? '',
    subject: initialData?.subject ?? '',
    notes: initialData?.notes ?? '',
    recipientName: initialData?.recipientName ?? '',
    recipientAddress: initialData?.recipientAddress ?? '',
    recipientPhone: initialData?.recipientPhone ?? '',
    shippingCourierCode: initialData?.courierCode ?? '',
    shippingAwb: initialData?.awb ?? '',
    shippingPhoneLast5: initialData?.phoneLast5 ?? '',
    partnerId: '',
  });

  const handlePartnerChange = (partnerId: string) => {
    const partner = partners.find((p) => p.id === partnerId);
    if (partner) {
      setFormData((prev) => ({
        ...prev,
        partnerId,
        recipientName: partner.name,
        recipientAddress: partner.address || '',
        recipientPhone: partner.phone || '',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        partnerId: '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.locationId) throw new Error(t('errorSelectLocation'));
      if (mode === 'edit' && initialData?.id) {
        await updateOutgoingShipmentAction(initialData.id, formData);
        toast.success(t('successSaved'));
        router.push(`/logistics/outgoing-shipments/${initialData.id}`);
      } else {
        await createOutgoingShipmentAction(formData);
        toast.success(tCommon('successCreated'));
        router.push('/logistics/outgoing-shipments');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8 rounded-xl border border-brand-cream-3 bg-card p-6 shadow-soft max-w-3xl"
    >
      {error && (
        <div className="rounded-lg bg-brand-red-light p-4 text-sm text-brand-red">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('number')}</label>
          <input
            type="text"
            required
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            value={formData.number}
            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('location')}</label>
          <select
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            value={formData.locationId}
            onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
            required
          >
            <option value="" disabled>
              {t('selectLocation')}
            </option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {pickLocalized(l.name, locale, l.code)}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('subject')}</label>
          <input
            type="text"
            required
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder={t('subjectPlaceholder')}
          />
        </div>

        <div className="col-span-2 space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('autofillPartner')}</label>
          <select
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            value={formData.partnerId}
            onChange={(e) => handlePartnerChange(e.target.value)}
          >
            <option value="">{t('selectPartner')}</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('recipientName')}</label>
          <input
            type="text"
            required
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            value={formData.recipientName}
            onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('recipientPhone')}</label>
          <input
            type="text"
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            value={formData.recipientPhone}
            onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
          />
        </div>

        <div className="col-span-2 space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('recipientAddress')}</label>
          <textarea
            required
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            rows={3}
            value={formData.recipientAddress}
            onChange={(e) => setFormData({ ...formData, recipientAddress: e.target.value })}
          />
        </div>

        <div className="col-span-2 mt-4 pt-4 border-t border-brand-cream-2">
          <h3 className="text-lg font-semibold text-brand-ink-1 mb-4">{t('shippingDetails')}</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink-3">{t('courierCode')}</label>
              <Select
                value={formData.shippingCourierCode}
                onChange={(e) => setFormData({ ...formData, shippingCourierCode: e.target.value })}
                className="w-full"
              >
                <option value="">{t('selectCourier')}</option>
                {COURIERS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink-3">{t('awb')}</label>
              <input
                type="text"
                className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
                value={formData.shippingAwb}
                onChange={(e) => setFormData({ ...formData, shippingAwb: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-brand-cream-2">
        <Button
          variant="secondary"
          size="md"
          className="rounded-lg"
          onClick={() => router.back()}
          type="button"
        >
          {t('cancel')}
        </Button>
        <Button variant="primary" size="lg" className="rounded-lg" type="submit" disabled={loading}>
          {loading ? t('saving') : t('saveAction')}
        </Button>
      </div>
    </form>
  );
}
