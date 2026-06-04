'use client';

import { PageHeader } from '@/components/page-header';
import { InlineAlert } from '@/components/confirm-dialog';
import { Button, Input, IntegerInput, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateTransferAction } from '../../actions';

interface Props {
  data: any;
  locations: Array<{ id: string; name: string; code: string }>;
  products: Array<{ id: string; name: string; uom: string }>;
}

export function EditTransferForm({ data, locations, products }: Props) {
  const t = useTranslations('inventory.transfer');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [fromLocationId, setFromLocationId] = useState(data.fromLocationId);
  const [toLocationId, setToLocationId] = useState(data.toLocationId);
  const [transferDate, setTransferDate] = useState(data.transferDate);
  const [notes, setNotes] = useState(data.notes || '');
  const [lines, setLines] = useState<
    Array<{ productId: string; name: string; qty: number; uom: string; batchNo?: string; expiryDate?: string }>
  >(
    data.lines.map((l: any) => ({
      productId: l.productId,
      name: l.productName,
      qty: Number(l.qtySent),
      uom: l.uom,
      batchNo: l.batchNo || undefined,
      expiryDate: l.expiryDate || undefined,
    })),
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const payload = {
      fromLocationId,
      toLocationId,
      transferDate,
      notes,
      lines: lines
        .filter((l) => l.productId)
        .map((l) => ({
          productId: l.productId,
          qty: String(l.qty),
          uom: l.uom,
          batchNo: l.batchNo || undefined,
          expiryDate: l.expiryDate || undefined,
        })),
    };

    startTransition(async () => {
      const res = await updateTransferAction(data.id, data.version, payload);
      if (res?.error) {
        setErrorMsg(res.error);
        return;
      }
      if (res?.ok) {
        router.push(`/inventory/transfer/${data.id}`);
      }
    });
  };

  return (
    <div className="h-full w-full overflow-y-auto space-y-6 pb-24 px-4 pt-4">
      <PageHeader
        title={<>{t('editTitle')} — {data.number}</>}
        description={<>{t('subtitle')}</>}
      />

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        {errorMsg && (
          <div className="mb-4">
            <InlineAlert message={errorMsg} tone="error" onDismiss={() => setErrorMsg(null)} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink-2">
                {t('fromLocation')}
              </label>
              <Select
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
              <Input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink-2">
                {t('notes')}
              </label>
              <Input
                placeholder={`${t('notes')}...`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
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
                    <IntegerInput
                      min="1"
                      value={line.qty}
                      onChange={(e) => {
                        const qty = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
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
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-cream-3">
            <Link href={`/inventory/transfer/${data.id}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-red disabled:pointer-events-none disabled:opacity-50 border border-brand-cream-3 bg-card hover:bg-brand-cream-2 text-brand-ink h-9 px-4 py-2">
              {tCommon('actions.cancel')}
            </Link>
            <Button type="submit" disabled={isPending || lines.filter(l => l.productId).length === 0}>
              {isPending ? tCommon('actions.saving') : tCommon('actions.save')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
