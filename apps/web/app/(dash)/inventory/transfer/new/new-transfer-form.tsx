'use client';

import { PageHeader } from '@/components/page-header';
import { Button, Input, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { createTransferAction } from '../actions';

interface Props {
  locations: Array<{ id: string; name: string; code: string }>;
  products: Array<{ id: string; name: string; uom: string }>;
  defaultLocationId: string | null;
}

export function NewTransferForm({ locations, products, defaultLocationId }: Props) {
  const t = useTranslations('inventory.transfer');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [state, submitAction, isPending] = useActionState(createTransferAction, null);

  const [fromLocationId, setFromLocationId] = useState(defaultLocationId || '');
  const [toLocationId, setToLocationId] = useState('');
  const [lines, setLines] = useState<
    Array<{ productId: string; name: string; qty: number; uom: string; batchNo?: string; expiryDate?: string }>
  >([]);

  useEffect(() => {
    if (state?.ok && state?.transferId) {
      router.push(`/inventory/transfer/${state.transferId}`);
    }
  }, [state, router]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="h-full w-full overflow-y-auto space-y-6 pb-24 px-4 pt-4">
      <PageHeader
        title={<>{t('new')}</>}
        description={<>{t('subtitle')}</>}
      />

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        {state?.error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <form action={submitAction} className="grid gap-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink-2">
                {t('fromLocation')}
              </label>
              <Select
                name="fromLocationId"
                value={fromLocationId}
                onChange={(e) => setFromLocationId(e.target.value)}
                required
              >
                <option value="" disabled>{tCommon('actions.select')} {t('fromLocation')}</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink-2">
                {t('toLocation')}
              </label>
              <Select
                name="toLocationId"
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                required
              >
                <option value="" disabled>{tCommon('actions.select')} {t('toLocation')}</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink-2">
                {t('date')}
              </label>
              <Input name="transferDate" type="date" defaultValue={today} required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink-2">
                {t('notes')}
              </label>
              <Input name="notes" placeholder={`${t('notes')}...`} />
            </div>
          </div>

          <div className="rounded-xl border border-brand-cream-3 p-4">
            <h3 className="mb-4 text-sm font-semibold text-brand-ink">{t('lines')}</h3>
            <div className="space-y-3">
              {lines.map((line, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-end gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream-2/50 p-3"
                >
                  <div className="flex-1 min-w-[200px]">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {tCommon('labels.product')}
                    </span>
                    <Select
                      value={line.productId}
                      onChange={(e) => {
                        const product = products.find((p) => p.id === e.target.value);
                        if (!product) return;
                        const newLines = [...lines];
                        newLines[index] = {
                          productId: product.id,
                          name: product.name,
                          qty: line.qty || 1,
                          uom: product.uom,
                        };
                        setLines(newLines);
                      }}
                    >
                      <option value="" disabled>{tCommon('actions.select')} {tCommon('labels.product')}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-24">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      Qty
                    </span>
                    <Input
                      type="number"
                      min="1"
                      step="any"
                      value={line.qty}
                      onChange={(e) => {
                        const qty = Math.max(1, Number.parseFloat(e.target.value) || 1);
                        const newLines = [...lines];
                        newLines[index] = { ...line, qty };
                        setLines(newLines);
                      }}
                    />
                  </div>
                  <div className="w-24">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      UoM
                    </span>
                    <Input type="text" readOnly value={line.uom} className="bg-brand-cream/50" />
                  </div>
                  <div className="w-32">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {t('batchNo')}
                    </span>
                    <Input
                      type="text"
                      placeholder={t('batchNoPlaceholder')}
                      value={line.batchNo || ''}
                      onChange={(e) => {
                        const newLines = [...lines];
                        newLines[index] = { ...line, batchNo: e.target.value };
                        setLines(newLines);
                      }}
                    />
                  </div>
                  <div className="w-36">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {t('expiryDate')}
                    </span>
                    <Input
                      type="date"
                      value={line.expiryDate || ''}
                      onChange={(e) => {
                        const newLines = [...lines];
                        newLines[index] = { ...line, expiryDate: e.target.value };
                        setLines(newLines);
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-brand-red mb-1"
                    onClick={() => {
                      setLines(lines.filter((_, i) => i !== index));
                    }}
                  >
                    {tCommon('actions.delete')}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setLines([...lines, { productId: '', name: '', qty: 1, uom: '' }]);
                }}
              >
                + {tCommon('actions.add')}
              </Button>
            </div>
            <input
              type="hidden"
              name="linesJson"
              value={JSON.stringify(lines.filter((l) => l.productId))}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-cream-3">
            <Link href="/inventory/transfer" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-red disabled:pointer-events-none disabled:opacity-50 border border-brand-cream-3 bg-card hover:bg-brand-cream-2 text-brand-ink h-9 px-4 py-2">
              {tCommon('actions.cancel')}
            </Link>
            <Button type="submit" disabled={isPending || lines.filter(l => l.productId).length === 0}>
              {isPending ? tCommon('actions.saving') : tCommon('actions.create')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
