'use client';

import type { LoyaltyConfig } from '@erp/services/crm';
import { Button, Input } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { saveLoyaltyConfig } from './actions';

interface TierDraft {
  key: number;
  code: string;
  minLifetimePoints: number;
}

interface Props {
  initial: LoyaltyConfig;
}

export function LoyaltySettingsForm({ initial }: Props) {
  const t = useTranslations('settings.loyalty');
  const [state, action, pending] = useActionState(saveLoyaltyConfig, { ok: false });

  const [rupiahPerPoint, setRupiahPerPoint] = useState(initial.rupiahPerPoint);
  const [tiers, setTiers] = useState<TierDraft[]>(() =>
    initial.tiers.map((tier, idx) => ({
      key: idx,
      code: tier.code,
      minLifetimePoints: tier.minLifetimePoints,
    })),
  );

  function updateTier(key: number, patch: Partial<TierDraft>) {
    setTiers((prev) => prev.map((tier) => (tier.key === key ? { ...tier, ...patch } : tier)));
  }

  function addTier() {
    setTiers((prev) => [
      ...prev,
      {
        key: Math.max(0, ...prev.map((tier) => tier.key)) + 1,
        code: '',
        minLifetimePoints: 0,
      },
    ]);
  }

  function removeTier(key: number) {
    setTiers((prev) => (prev.length > 1 ? prev.filter((tier) => tier.key !== key) : prev));
  }

  const lifetimeForUpgrade = (points: number) => points * rupiahPerPoint;

  return (
    <form action={action} className="space-y-6">
      {state.message ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            state.ok
              ? 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {t(state.message.replace('settings.loyalty.', '') as never)}
        </div>
      ) : null}

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{t('earnRateTitle')}</h2>
        <p className="mt-1 text-sm text-brand-ink-3">{t('earnRateHint')}</p>
        <div className="mt-4 grid gap-4 md:max-w-md">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{t('rupiahPerPoint')}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-brand-ink-3">Rp</span>
              <Input
                name="rupiahPerPoint"
                type="number"
                min={1}
                step={1000}
                value={rupiahPerPoint}
                onChange={(event) => setRupiahPerPoint(Number(event.target.value))}
                required
              />
              <span className="whitespace-nowrap text-sm text-brand-ink-3">{t('pointEqual')}</span>
            </div>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-brand-ink">{t('tiersTitle')}</h2>
            <p className="mt-1 text-sm text-brand-ink-3">{t('tiersHint')}</p>
          </div>
          <button
            type="button"
            onClick={addTier}
            className="rounded-md border border-brand-cream-3 bg-card px-3 py-1.5 text-xs font-semibold text-brand-ink hover:border-brand-red/40 hover:text-brand-red"
          >
            {t('addTier')}
          </button>
        </div>

        <div className="space-y-2">
          {tiers
            .slice()
            .sort((a, b) => a.minLifetimePoints - b.minLifetimePoints)
            .map((tier) => (
              <div
                key={tier.key}
                className="grid gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-3 md:grid-cols-[1.2fr_1fr_1.4fr_auto]"
              >
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-ink-3">
                    {t('tierCode')}
                  </span>
                  <Input
                    name="tierCode"
                    value={tier.code}
                    onChange={(event) => updateTier(tier.key, { code: event.target.value })}
                    placeholder={t('tierCodePlaceholder')}
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-ink-3">
                    {t('minPoints')}
                  </span>
                  <Input
                    name="tierPoints"
                    type="number"
                    min={0}
                    value={tier.minLifetimePoints}
                    onChange={(event) =>
                      updateTier(tier.key, {
                        minLifetimePoints: Number.parseInt(event.target.value, 10) || 0,
                      })
                    }
                    required
                  />
                </label>
                <div className="flex flex-col justify-end text-xs text-brand-ink-3">
                  <span>
                    {t('lifetimeSpendApprox', {
                      amount: new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        maximumFractionDigits: 0,
                      }).format(lifetimeForUpgrade(tier.minLifetimePoints)),
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeTier(tier.key)}
                  disabled={tiers.length <= 1}
                  className="self-end rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-xs font-semibold text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red disabled:opacity-40"
                >
                  {t('removeTier')}
                </button>
              </div>
            ))}
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="submit"
          disabled={pending}
          className="rounded-lg "
          variant="primary"
          size="lg"
        >
          {pending ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
