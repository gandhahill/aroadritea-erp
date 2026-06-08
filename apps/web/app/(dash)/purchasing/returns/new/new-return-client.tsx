'use client';

import { Button, Input, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createPurchaseReturnAction, fetchGrnForReturnAction } from '../actions';

interface Props {
  defaultGrnId: string;
  defaultLocationId: string;
  grns: Array<{ id: string; number: string; poNumber: string; receivedDate: string }>;
}

interface GrnLineForm {
  grnLineId: string;
  productId: string;
  productName: string;
  variantId: string | null;
  uom: string;
  qtyReceived: string;
  qtyReturned: string;
  unitCost: string;
  selected: boolean;
}

/** Display a numeric qty as a whole number when it has no real fraction. */
function fmtQty(value: string | number): string {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value ?? '');
}

export function NewReturnClient({ defaultGrnId, defaultLocationId, grns }: Props) {
  const t = useTranslations('purchasing.returns');
  const router = useRouter();
  const [grnInput, setGrnInput] = useState(defaultGrnId);
  const [grn, setGrn] = useState<{
    id: string;
    number: string;
    locationId: string;
    receivedDate: string;
  } | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<GrnLineForm[]>([]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleLoadGrn(idArg?: string) {
    const id = (idArg ?? grnInput).trim();
    if (!id) return;
    setError(null);
    startTransition(async () => {
      const res = await fetchGrnForReturnAction(id);
      if (res.error) {
        setError(res.error);
        setGrn(null);
        setLines([]);
        return;
      }
      setGrn(res.grn ?? null);
      setSupplierId(res.supplierId ?? '');
      setLines(
        (res.lines ?? []).map((l) => ({
          grnLineId: l.id,
          productId: l.productId,
          productName: l.productName ?? l.productId,
          variantId: l.variantId,
          uom: l.uom,
          qtyReceived: l.qtyReceived,
          qtyReturned: '0',
          unitCost: l.unitCost,
          selected: false,
        })),
      );
    });
  }

  // Auto-load when arriving via deep link (?grnId=...).
  useEffect(() => {
    if (defaultGrnId) handleLoadGrn(defaultGrnId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultGrnId]);

  function updateLine(idx: number, patch: Partial<GrnLineForm>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function handleSubmit() {
    if (!grn) {
      setError('grn_required');
      return;
    }
    if (!reason.trim()) {
      setError('reason_required');
      return;
    }
    const selectedLines = lines
      .filter((l) => l.selected && Number.parseFloat(l.qtyReturned) > 0)
      .map((l) => ({
        grnLineId: l.grnLineId,
        productId: l.productId,
        variantId: l.variantId ?? undefined,
        qtyReturned: l.qtyReturned,
        uom: l.uom,
        unitCost: l.unitCost,
      }));
    if (selectedLines.length === 0) {
      setError('lines_required');
      return;
    }
    startTransition(async () => {
      const res = await createPurchaseReturnAction({
        locationId: grn.locationId || defaultLocationId,
        grnId: grn.id,
        supplierId,
        returnDate,
        reason,
        notes: notes || undefined,
        lines: selectedLines,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.id) router.push(`/purchasing/returns/${res.id}`);
    });
  }

  return (
    <div className="space-y-6">
      {/* Step 1 — load GRN */}
      <section className="rounded-xl border border-brand-cream-3 bg-card p-4">
        <h2 className="text-sm font-semibold text-brand-ink">{t('step1')}</h2>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-brand-ink-2">{t('selectGrn')}</span>
            <Select
              value={grnInput}
              onChange={(e) => {
                setGrnInput(e.target.value);
                if (e.target.value) handleLoadGrn(e.target.value);
              }}
              className="w-80"
              disabled={pending}
            >
              <option value="">{t('selectGrnPlaceholder')}</option>
              {grns.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.number} · {g.poNumber} · {g.receivedDate}
                </option>
              ))}
            </Select>
          </label>
          {grns.length === 0 ? (
            <p className="text-xs text-brand-ink-3">{t('noConfirmedGrn')}</p>
          ) : null}
          {grn ? (
            <div className="text-xs text-brand-ink-3">
              <span className="font-mono text-brand-ink">{grn.number}</span> · {grn.receivedDate}
            </div>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Step 2 — lines */}
      {lines.length > 0 ? (
        <section className="rounded-xl border border-brand-cream-3 bg-card p-4">
          <h2 className="text-sm font-semibold text-brand-ink">{t('step2')}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-brand-ink-2">
                <tr>
                  <th className="px-2 py-1">{t('selectCol')}</th>
                  <th className="px-2 py-1">{t('lineHeader.product')}</th>
                  <th className="px-2 py-1 text-right">{t('lineHeader.received')}</th>
                  <th className="px-2 py-1 text-right">{t('lineHeader.qty')}</th>
                  <th className="px-2 py-1">{t('lineHeader.uom')}</th>
                  <th className="px-2 py-1 text-right">{t('lineHeader.unitCost')}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.grnLineId} className="border-t border-brand-cream-3 text-sm">
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={l.selected}
                        onChange={(e) => updateLine(i, { selected: e.target.checked })}
                      />
                    </td>
                    <td className="px-2 py-1 text-brand-ink">{l.productName}</td>
                    <td className="px-2 py-1 text-right font-mono text-brand-ink-2">
                      {fmtQty(l.qtyReceived)}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Input
                        type="number"
                        value={l.qtyReturned}
                        onChange={(e) => updateLine(i, { qtyReturned: e.target.value })}
                        className="w-24 text-right"
                        disabled={!l.selected}
                        step="0.001"
                        min="0"
                        max={l.qtyReceived}
                      />
                    </td>
                    <td className="px-2 py-1 text-brand-ink-2">{l.uom}</td>
                    <td className="px-2 py-1 text-right font-mono">
                      <Input
                        type="number"
                        value={l.unitCost}
                        onChange={(e) => updateLine(i, { unitCost: e.target.value })}
                        className="w-32 text-right"
                        disabled={!l.selected}
                        step="1"
                        min="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Step 3 — reason + submit */}
      {grn ? (
        <section className="rounded-xl border border-brand-cream-3 bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-brand-ink">{t('step3')}</h2>
          <label className="block space-y-1 text-sm">
            <span className="text-brand-ink-2">{t('returnDate')}</span>
            <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-brand-ink-2">{t('reason')}</span>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-brand-ink-2">{t('notesLabel')}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-end">
            <Button variant="primary" size="md" disabled={pending} onClick={handleSubmit}>
              {t('saveDraft')}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
