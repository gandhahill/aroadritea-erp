'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState } from 'react';
import { receiveGoodsAction } from '../../actions';

interface LineItem {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  uom: string;
  qtyOrdered: string;
  qtyReceived: string;
}

export function GrnForm({ poId, lines }: { poId: string; lines: LineItem[] }) {
  const t = useTranslations('purchasing.grn');
  const [state, action, isPending] = useActionState(receiveGoodsAction, { success: false } as { success: boolean; error?: string });
  const [success, setSuccess] = useState(false);

  // local state for form inputs
  const [receiveData, setReceiveData] = useState<Record<string, { qty: string; batch: string; expiry: string }>>({});

  useEffect(() => {
    // initialize state
    const initial: Record<string, { qty: string; batch: string; expiry: string }> = {};
    for (const line of lines) {
      const remaining = Number(line.qtyOrdered) - Number(line.qtyReceived);
      if (remaining > 0) {
        initial[line.id] = { qty: remaining.toString(), batch: '', expiry: '' };
      }
    }
    setReceiveData(initial);
  }, [lines]);

  useEffect(() => {
    if (state.success) {
      setSuccess(true);
    }
  }, [state]);

  if (success) {
    return (
      <div className="rounded-xl border border-brand-jade/30 bg-brand-jade/10 p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-brand-jade">{t('successReceived')}</h2>
      </div>
    );
  }

  // filter out lines that are fully received
  const receivableLines = lines.filter(l => Number(l.qtyOrdered) > Number(l.qtyReceived));

  if (receivableLines.length === 0) {
    return null; // The parent handles the 'fully received' UI
  }

  const handleSubmit = (formData: FormData) => {
    // Collect the structured linesData
    const linesToSubmit = receivableLines.map(line => {
      const data = receiveData[line.id];
      return {
        poLineId: line.id,
        productId: line.productId,
        variantId: line.variantId,
        uom: line.uom,
        qtyReceived: data?.qty || '0',
        batchNo: data?.batch || '',
        expiryDate: data?.expiry || ''
      };
    }).filter(l => Number(l.qtyReceived) > 0);

    formData.set('linesData', JSON.stringify(linesToSubmit));
    formData.set('poId', poId);
    
    // Call the original action
    action(formData);
  };

  const updateLineData = (id: string, field: 'qty' | 'batch' | 'expiry', value: string) => {
    setReceiveData(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { qty: '0', batch: '', expiry: '' }),
        [field]: value
      }
    }));
  };

  return (
    <div className="rounded-xl border border-brand-cream-3 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-brand-cream-3 bg-brand-cream-1/50 px-6 py-4">
        <h2 className="text-base font-semibold text-brand-ink">{t('createGrn')}</h2>
        <p className="mt-1 text-sm text-brand-ink-3">{t('grnFormSubtitle')}</p>
      </div>

      <form action={handleSubmit} className="p-6 space-y-6">
        {state.error && (
          <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
            {state.error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-cream-3 text-sm text-left">
            <thead className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              <tr>
                <th className="py-2 pr-4">{t('product')}</th>
                <th className="py-2 px-4 text-right">{t('ordered')}</th>
                <th className="py-2 px-4 text-right">{t('alreadyReceived')}</th>
                <th className="py-2 px-4 w-32">{t('receivingNow')}</th>
                <th className="py-2 px-4">{t('batchNo')}</th>
                <th className="py-2 pl-4">{t('expiryDate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3">
              {receivableLines.map(line => {
                const data = receiveData[line.id] || { qty: '0', batch: '', expiry: '' };
                const remaining = Number(line.qtyOrdered) - Number(line.qtyReceived);
                
                return (
                  <tr key={line.id} className="group">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-brand-ink">{line.productName}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-brand-ink">{line.qtyOrdered} {line.uom}</td>
                    <td className="py-3 px-4 text-right font-mono text-brand-ink">{line.qtyReceived} {line.uom}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max={remaining}
                          required
                          value={data.qty}
                          onChange={e => updateLineData(line.id, 'qty', e.target.value)}
                          className="w-full rounded-md border border-brand-cream-3 bg-brand-cream px-2 py-1.5 text-right font-mono text-sm focus:border-brand-red focus:outline-none"
                        />
                        <span className="text-xs text-brand-ink-3">{line.uom}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={data.batch}
                        onChange={e => updateLineData(line.id, 'batch', e.target.value)}
                        className="w-full rounded-md border border-brand-cream-3 bg-brand-cream px-2 py-1.5 text-sm focus:border-brand-red focus:outline-none"
                      />
                    </td>
                    <td className="py-3 pl-4">
                      <input
                        type="date"
                        value={data.expiry}
                        onChange={e => updateLineData(line.id, 'expiry', e.target.value)}
                        className="w-full rounded-md border border-brand-cream-3 bg-brand-cream px-2 py-1.5 text-sm focus:border-brand-red focus:outline-none"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pt-4 border-t border-brand-cream-3 flex items-start gap-6">
          <div className="flex-1">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-brand-ink">{t('notes')}</span>
              <textarea
                name="notes"
                rows={2}
                className="w-full rounded-md border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
              />
            </label>
          </div>
          <div className="flex-none pt-6">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-brand-jade px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-jade/90 disabled:opacity-50"
            >
              {isPending ? t('receiving') : t('confirmReceive')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
