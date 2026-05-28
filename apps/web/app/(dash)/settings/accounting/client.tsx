'use client';

import { useState } from 'react';
import { toast } from '@erp/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { saveAccountingSettingsAction } from './actions';
import { Button } from '@erp/ui';

export function AccountingSettingsForm({ accounts, defaultApId }: { accounts: any[], defaultApId: string }) {
  const router = useRouter();
  const t = useTranslations('settings.accounting');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [apAccountId, setApAccountId] = useState(defaultApId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!apAccountId) throw new Error(t('errorSelectAccount'));
      await saveAccountingSettingsAction(apAccountId);
      toast.success('Berhasil disimpan');
      router.refresh();
      // Optional: show a success toast here
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 rounded-xl border border-brand-cream-3 bg-card p-6 shadow-soft max-w-2xl">
      {error && (
        <div className="rounded-lg bg-brand-red-light p-4 text-sm text-brand-red">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-brand-ink-1 mb-2">{t('purchasing')}</h3>
          <p className="text-sm text-brand-ink-3 mb-4">{t('purchasingDesc')}</p>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-brand-ink-3">{t('apAccount')}</label>
            <select
              className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
              value={apAccountId}
              onChange={e => setApAccountId(e.target.value)}
              required
            >
              <option value="" disabled>{t('selectAccount')}</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name?.id || acc.name?.en || acc.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-brand-ink-4 mt-1">{t('apAccountHelp')}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-brand-cream-2">
        <Button type="submit" disabled={loading || !apAccountId}>
          {loading ? t('saving') : t('saveAction')}
        </Button>
      </div>
    </form>
  );
}
