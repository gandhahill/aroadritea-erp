'use client';

import { Button, Input, Select, Table, TableBody, TableCell, TableHead } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { fetchHppSummaryAction, postHppAdjustmentAction } from './actions';

interface Props {
  locations: Array<{ value: string; label: string }>;
}

function formatMoney(v: string): string {
  const num = Number.parseInt(v, 10);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
}

interface SummaryLine {
  productId: string;
  productName: string;
  sku: string;
  hppCategory: 'hpp' | 'supply_expense';
  uom: string;
  physicalQty: number;
  avgUnitCost: string;
  physicalValue: string;
}

export function HppClient({ locations }: Props) {
  const t = useTranslations('accounting.hpp');
  const [locationId, setLocationId] = useState(locations[0]?.value ?? '');
  const [periodEnd, setPeriodEnd] = useState(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return last.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [lines, setLines] = useState<SummaryLine[]>([]);
  const [totalHpp, setTotalHpp] = useState('0');
  const [totalSupply, setTotalSupply] = useState('0');
  const [hppAdj, setHppAdj] = useState('');
  const [supplyAdj, setSupplyAdj] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSummary = async () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const res = await fetchHppSummaryAction(locationId, periodEnd);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setLines(res.value.lines);
    setTotalHpp(res.value.totalHppValue);
    setTotalSupply(res.value.totalSupplyValue);
  };

  const doPost = async () => {
    if (!hppAdj && !supplyAdj) return;
    setPosting(true);
    setError(null);
    const res = await postHppAdjustmentAction({
      locationId,
      periodEnd,
      hppAdjustmentAmount: hppAdj || '0',
      supplyAdjustmentAmount: supplyAdj || '0',
    });
    setPosting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess(t('postSuccess'));
    setHppAdj('');
    setSupplyAdj('');
  };

  const hppLines = lines.filter((l) => l.hppCategory === 'hpp');
  const supplyLines = lines.filter((l) => l.hppCategory === 'supply_expense');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4 rounded-xl border border-brand-cream-3 bg-card p-5">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('location')}</span>
          <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {locations.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('periodEnd')}</span>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </label>
        <div className="flex items-end">
          <Button variant="primary" onClick={loadSummary} disabled={loading || !locationId}>
            {loading ? t('loading') : t('loadSummary')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {lines.length > 0 && (
        <>
          <section className="rounded-xl border border-brand-cream-3 bg-card shadow-sm">
            <div className="border-b border-brand-cream-3 px-5 py-4 flex justify-between items-center">
              <h3 className="text-base font-semibold text-brand-ink">{t('hppItems')}</h3>
              <span className="text-sm font-medium text-brand-ember-5">
                {t('totalPhysicalValue')}: {formatMoney(totalHpp)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <thead className="bg-brand-cream">
                  <tr>
                    <TableHead className="px-4 py-3">{t('sku')}</TableHead>
                    <TableHead className="px-4 py-3">{t('product')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('qty')}</TableHead>
                    <TableHead className="px-4 py-3">{t('uom')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('unitCost')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('physicalValue')}</TableHead>
                  </tr>
                </thead>
                <TableBody>
                  {hppLines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-brand-ink-3">
                        {t('noItems')}
                      </td>
                    </tr>
                  ) : (
                    hppLines.map((line) => (
                      <tr key={line.productId}>
                        <TableCell className="px-4 py-3 font-mono text-xs">{line.sku}</TableCell>
                        <TableCell className="px-4 py-3">{line.productName}</TableCell>
                        <TableCell className="px-4 py-3 text-right">{line.physicalQty}</TableCell>
                        <TableCell className="px-4 py-3">{line.uom}</TableCell>
                        <TableCell className="px-4 py-3 text-right">{formatMoney(line.avgUnitCost)}</TableCell>
                        <TableCell className="px-4 py-3 text-right font-medium">{formatMoney(line.physicalValue)}</TableCell>
                      </tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="rounded-xl border border-brand-cream-3 bg-card shadow-sm">
            <div className="border-b border-brand-cream-3 px-5 py-4 flex justify-between items-center">
              <h3 className="text-base font-semibold text-brand-ink">{t('supplyItems')}</h3>
              <span className="text-sm font-medium text-brand-ember-5">
                {t('totalPhysicalValue')}: {formatMoney(totalSupply)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <thead className="bg-brand-cream">
                  <tr>
                    <TableHead className="px-4 py-3">{t('sku')}</TableHead>
                    <TableHead className="px-4 py-3">{t('product')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('qty')}</TableHead>
                    <TableHead className="px-4 py-3">{t('uom')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('unitCost')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('physicalValue')}</TableHead>
                  </tr>
                </thead>
                <TableBody>
                  {supplyLines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-brand-ink-3">
                        {t('noItems')}
                      </td>
                    </tr>
                  ) : (
                    supplyLines.map((line) => (
                      <tr key={line.productId}>
                        <TableCell className="px-4 py-3 font-mono text-xs">{line.sku}</TableCell>
                        <TableCell className="px-4 py-3">{line.productName}</TableCell>
                        <TableCell className="px-4 py-3 text-right">{line.physicalQty}</TableCell>
                        <TableCell className="px-4 py-3">{line.uom}</TableCell>
                        <TableCell className="px-4 py-3 text-right">{formatMoney(line.avgUnitCost)}</TableCell>
                        <TableCell className="px-4 py-3 text-right font-medium">{formatMoney(line.physicalValue)}</TableCell>
                      </tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-brand-ink">{t('postAdjustment')}</h3>
            <p className="mb-4 text-sm text-brand-ink-3">{t('postDescription')}</p>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-brand-ink">{t('hppAdjustment')}</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={hppAdj}
                  onChange={(e) => setHppAdj(e.target.value.replace(/[^\d-]/g, ''))}
                  placeholder="0"
                />
                <span className="text-xs text-brand-ink-3">{t('hppAdjHint')}</span>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-brand-ink">{t('supplyAdjustment')}</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={supplyAdj}
                  onChange={(e) => setSupplyAdj(e.target.value.replace(/[^\d-]/g, ''))}
                  placeholder="0"
                />
                <span className="text-xs text-brand-ink-3">{t('supplyAdjHint')}</span>
              </label>
            </div>
            <div className="mt-4">
              <Button
                variant="primary"
                onClick={doPost}
                disabled={posting || (!hppAdj && !supplyAdj)}
              >
                {posting ? t('postingJournal') : t('postJournal')}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
