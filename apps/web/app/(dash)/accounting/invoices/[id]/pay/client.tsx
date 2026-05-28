'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { payInvoiceAction } from '../../actions';
import { Button } from '@erp/ui';

export function PayInvoiceForm({ invoice, bankAccounts }: { invoice: any, bankAccounts: any[] }) {
  const router = useRouter();
  const t = useTranslations('accounting.invoice');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!);
  const [accountId, setAccountId] = useState(bankAccounts[0]?.id || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!accountId) throw new Error(t('errorSelectAccount'));
      await payInvoiceAction(String(invoice.id), accountId, date);
      router.push('/accounting/invoices');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formattedTotal = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
  }).format(Number(invoice.total));

  return (
    <form onSubmit={handleSubmit} className="space-y-8 rounded-xl border border-brand-cream-3 bg-card p-6 shadow-soft max-w-2xl">
      {error && (
        <div className="rounded-lg bg-brand-red-light p-4 text-sm text-brand-red">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('amountToPay')}</label>
          <div className="text-3xl font-bold text-brand-ink-1">{formattedTotal}</div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('paymentDate')}</label>
          <input
            type="date"
            required
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('paymentAccount')}</label>
          <select
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            required
          >
            <option value="" disabled>{t('selectAccount')}</option>
            {bankAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.code} - {acc.name?.id || acc.name?.en || acc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => router.back()} type="button">
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={loading || !accountId}>
          {loading ? t('processing') : t('payAction')}
        </Button>
      </div>
    </form>
  );
}
