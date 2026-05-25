'use client';

import { Button, Input } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { adjustMemberPointsAction } from '../actions';

interface Props {
  memberId: string;
  currentBalance: number;
}

export function PointsAdjustClient({ memberId, currentBalance }: Props) {
  const t = useTranslations('crm.members');
  const router = useRouter();
  const [delta, setDelta] = useState('0');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSuccess(null);
    const d = Number.parseInt(delta, 10);
    if (!Number.isFinite(d) || d === 0) {
      setError(t('adjust.deltaInvalid'));
      return;
    }
    if (reason.trim().length < 3) {
      setError(t('adjust.reasonRequired'));
      return;
    }
    startTransition(async () => {
      const res = await adjustMemberPointsAction({ memberId, delta: d, reason: reason.trim() });
      if (!res.ok) {
        setError(res.error ?? 'Error');
        return;
      }
      setSuccess(
        t('adjust.successMessage', { balance: (res.balanceAfter ?? 0).toLocaleString('id-ID') }),
      );
      setReason('');
      setDelta('0');
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-brand-cream-3 bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-brand-ink">{t('adjust.title')}</h2>
      <p className="text-xs text-brand-ink-3">
        {t('adjust.help', { balance: currentBalance.toLocaleString('id-ID') })}
      </p>
      <label className="block space-y-1 text-sm">
        <span className="text-brand-ink-2">{t('adjust.delta')}</span>
        <Input
          type="number"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="100 or -50"
          step="1"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-brand-ink-2">{t('adjust.reason')}</span>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('adjust.reasonPlaceholder')}
        />
      </label>
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
          {success}
        </div>
      ) : null}
      <Button variant="primary" size="md" disabled={pending} onClick={submit}>
        {t('adjust.submit')}
      </Button>
    </div>
  );
}
