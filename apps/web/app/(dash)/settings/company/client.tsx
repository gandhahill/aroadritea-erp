'use client';

import { useState } from 'react';
import { toast } from '@erp/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { saveCompanySettingsAction, type CompanyInfo } from './actions';
import { Button } from '@erp/ui';

export function CompanySettingsForm({ defaults }: { defaults: CompanyInfo }) {
  const router = useRouter();
  const t = useTranslations('settings.company');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<CompanyInfo>(defaults);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await saveCompanySettingsAction(form);
      setSuccess(true);
      toast.success('Berhasil disimpan');
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
      className="space-y-8 rounded-xl border border-brand-cream-3 bg-card p-6 shadow-soft max-w-2xl"
    >
      {error && (
        <div className="rounded-lg bg-brand-red-light p-4 text-sm text-brand-red">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-brand-jade/10 p-4 text-sm text-brand-jade">
          {t('saved')}
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('companyName')}</label>
          <input
            type="text"
            required
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <p className="text-xs text-brand-ink-4">{t('companyNameHelp')}</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('companyAddress')}</label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <p className="text-xs text-brand-ink-4">{t('companyAddressHelp')}</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('companyNpwp')}</label>
          <input
            type="text"
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            placeholder="00.000.000.0-000.000"
            value={form.npwp}
            onChange={(e) => setForm({ ...form, npwp: e.target.value })}
          />
          <p className="text-xs text-brand-ink-4">{t('companyNpwpHelp')}</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('companyPhone')}</label>
          <input
            type="text"
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            placeholder="(0274) 000-0000"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-brand-cream-2">
        <Button type="submit" disabled={loading}>
          {loading ? t('saving') : t('saveAction')}
        </Button>
      </div>
    </form>
  );
}
