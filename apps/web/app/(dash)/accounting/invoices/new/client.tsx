'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createInvoiceAction } from '../actions';
import { Button } from '@erp/ui';

export function InvoiceForm({ accounts, locations }: { accounts: any[], locations: any[] }) {
  const router = useRouter();
  const t = useTranslations('accounting.invoice');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    number: `INV-${Date.now()}`,
    type: 'sales',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    partnerName: '',
    notes: '',
    locationId: locations[0]?.id || '',
  });

  const [lines, setLines] = useState([
    { accountId: '', description: '', quantity: 1, unitPrice: '0' }
  ]);

  const addLine = () => {
    setLines([...lines, { accountId: '', description: '', quantity: 1, unitPrice: '0' }]);
  };

  const updateLine = (index: number, field: keyof typeof lines[0], value: string | number) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value } as any;
    setLines(newLines);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        lines: lines.map(line => ({
          ...line,
          subtotal: (line.quantity * Number(line.unitPrice)).toString()
        }))
      };

      await createInvoiceAction(payload);
      router.push('/accounting/invoices');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 rounded-xl border border-brand-cream-3 bg-card p-6 shadow-soft">
      {error && (
        <div className="rounded-lg bg-brand-red-light p-4 text-sm text-brand-red">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('number')}</label>
          <input
            type="text"
            required
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
            value={formData.number}
            onChange={e => setFormData({ ...formData, number: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('new.partnerName')}</label>
          <input
            type="text"
            required
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
            value={formData.partnerName}
            onChange={e => setFormData({ ...formData, partnerName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('new.location')}</label>
          <select
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
            value={formData.locationId}
            onChange={e => setFormData({ ...formData, locationId: e.target.value })}
          >
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('date')}</label>
          <input
            type="date"
            required
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
            value={formData.date}
            onChange={e => setFormData({ ...formData, date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('dueDate')}</label>
          <input
            type="date"
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
            value={formData.dueDate}
            onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-brand-ink">{t('new.lineItems')}</h3>
          <Button type="button" onClick={addLine} variant="secondary">
            {t('new.addLine')}
          </Button>
        </div>

        <div className="space-y-4">
          {lines.map((line, idx) => (
            <div key={idx} className="flex gap-4 items-start">
              <div className="flex-1 space-y-2">
                <select
                  required
                  className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
                  value={line.accountId}
                  onChange={e => updateLine(idx, 'accountId', e.target.value)}
                >
                  <option value="">{t('new.selectAccount')}</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.nameId ?? acc.nameEn}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  required
                  placeholder={t('new.description')}
                  className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
                  value={line.description}
                  onChange={e => updateLine(idx, 'description', e.target.value)}
                />
              </div>
              <div className="w-24 space-y-2">
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
                  value={line.quantity}
                  onChange={e => updateLine(idx, 'quantity', Number(e.target.value))}
                />
              </div>
              <div className="w-40 space-y-2">
                <input
                  type="number"
                  required
                  className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
                  value={line.unitPrice}
                  onChange={e => updateLine(idx, 'unitPrice', e.target.value)}
                />
              </div>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="mt-2 text-brand-red hover:underline"
                >
                  {t('new.remove')}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-brand-cream-2">
        <Button type="submit" disabled={loading} className="bg-brand-red hover:bg-brand-red-dark text-white">
          {loading ? t('new.saving') : t('new.saveDraft')}
        </Button>
      </div>
    </form>
  );
}
