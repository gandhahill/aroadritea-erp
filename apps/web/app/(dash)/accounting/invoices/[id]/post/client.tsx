'use client';

import { useState } from 'react';
import { toast } from '@erp/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { postInvoiceAction } from '../../actions';
import { Button } from '@erp/ui';

export function PostInvoiceForm({ invoice, accounts }: { invoice: any, accounts: any[] }) {
  const router = useRouter();
  const t = useTranslations('accounting.invoice');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await postInvoiceAction(invoice.id, accountId);
      toast.success(t('success') || 'Berhasil disimpan');
      router.push('/accounting/invoices');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isSales = invoice.type === 'sales';
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-brand-cream-3 bg-card p-6 shadow-soft">
      {error && (
        <div className="rounded-lg bg-brand-red-light p-4 text-sm text-brand-red">
          {error}
        </div>
      )}

      <div className="mb-6 p-4 bg-brand-cream-1 rounded-lg border border-brand-cream-3 space-y-2">
        <h3 className="font-semibold text-brand-ink">{t('postAction.details')}</h3>
        <p className="text-sm text-brand-ink-2">{t('number')}: {invoice.number}</p>
        <p className="text-sm text-brand-ink-2">{t('type')}: <span className="capitalize">{invoice.type === 'sales' ? t('sales') : t('purchase')}</span></p>
        <p className="text-sm text-brand-ink-2">{t('partner')}: {invoice.partnerName}</p>
        <p className="text-sm text-brand-ink-2 font-mono">{t('total')}: {invoice.total.toString()}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">
            {isSales ? t('postAction.receivableLabel') : t('postAction.payableLabel')}
          </label>
          <p className="text-xs text-brand-ink-2">
            {isSales ? t('postAction.receivableDesc') : t('postAction.payableDesc')}
          </p>
          <select
            required
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
          >
            <option value="">{t('new.selectAccount')}</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.code} - {acc.nameId ?? acc.nameEn}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-brand-cream-2">
        <Button type="button" onClick={() => router.back()} variant="secondary" className="mr-3">
          {t('postAction.cancel')}
        </Button>
        <Button type="submit" disabled={loading || !accountId} className="bg-brand-jade hover:bg-brand-jade-dark text-white">
          {loading ? t('postAction.posting') : t('postAction.postCreate')}
        </Button>
      </div>
    </form>
  );
}
