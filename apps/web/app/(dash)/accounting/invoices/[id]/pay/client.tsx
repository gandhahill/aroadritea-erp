'use client';

import { toast } from '@erp/ui';
import { Button } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { payInvoiceAction } from '../../actions';

export function PayInvoiceForm({ invoice, bankAccounts }: { invoice: any; bankAccounts: any[] }) {
  const router = useRouter();
  const t = useTranslations('accounting.invoice');
  const tCommon = useTranslations('common.actions');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = Number(invoice.total) - Number(invoice.amountPaid || 0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!);
  const [accountId, setAccountId] = useState(bankAccounts[0]?.id || '');
  const [amountStr, setAmountStr] = useState(String(remaining));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!accountId) throw new Error(t('errorSelectAccount'));
      const amt = BigInt(amountStr);
      if (amt <= 0n) throw new Error(t('invalidAmount') || 'Invalid amount');
      if (amt > BigInt(remaining))
        throw new Error(t('amountExceeds') || 'Amount exceeds remaining balance');

      await payInvoiceAction(String(invoice.id), accountId, amountStr, date);
      toast.success(tCommon('successSaved'));
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

  const formattedRemaining = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
  }).format(remaining);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8 rounded-xl border border-brand-cream-3 bg-card p-6 shadow-soft max-w-2xl"
    >
      {error && (
        <div className="rounded-lg bg-brand-red-light p-4 text-sm text-brand-red">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('amountToPay')}</label>
          <p className="text-xs text-brand-ink-3 mb-1">
            Total: {formattedTotal} • Remaining: {formattedRemaining}
          </p>
          <input
            type="number"
            required
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red text-2xl font-bold"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            max={remaining}
            min={1}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('paymentDate')}</label>
          <input
            type="date"
            required
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('paymentAccount')}</label>
          <select
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2 focus:ring-2 focus:ring-brand-red"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            <option value="" disabled>
              {t('selectAccount')}
            </option>
            {bankAccounts.map((acc) => (
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
