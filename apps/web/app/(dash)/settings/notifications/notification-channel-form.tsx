'use client';

import { Button, Input, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { createNotificationChannelAction } from './actions';

export function NotificationChannelForm() {
  const t = useTranslations('settings.notifications.form');
  const [state, action, pending] = useActionState(createNotificationChannelAction, {
    success: false,
  });

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm"
    >
      <div>
        <h2 className="text-base font-semibold text-brand-ink">{t('title')}</h2>
        <p className="mt-1 text-sm text-brand-ink-3">{t('description')}</p>
      </div>

      {state.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-lg border border-brand-jade/30 bg-brand-jade/10 px-3 py-2 text-sm text-brand-jade">
          {t('success')}
        </div>
      ) : null}

      <label className="space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">{t('fields.label')}</span>
        <Input name="label" required />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">{t('fields.type')}</span>
        <Select name="channelType" required defaultValue="email">
          <option value="email">{t('types.email')}</option>
        </Select>
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">{t('fields.target')}</span>
        <Input name="target" required placeholder="ops@aroadritea.com" />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">{t('fields.purpose')}</span>
        <Select name="purpose" required defaultValue="all">
          <option value="all">{t('purposes.all')}</option>
          <option value="outage">{t('purposes.outage')}</option>
          <option value="stock_alert">{t('purposes.stockAlert')}</option>
          <option value="party_ledger">{t('purposes.partyLedger')}</option>
        </Select>
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-brand-ink">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked
          className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
        />
        {t('fields.isActive')}
      </label>

      <Button type="submit" disabled={pending} className="rounded-lg " variant="primary" size="lg">
        {pending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
