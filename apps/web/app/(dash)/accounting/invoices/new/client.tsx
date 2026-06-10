'use client';

import { toast } from '@erp/ui';
import { Button } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createInvoiceAction } from '../actions';

interface Partner {
  id: string;
  name: string;
  kind: string;
  address: string | null;
  npwp: string | null;
  paymentTermsDays: number | null;
}

const TERMS_OPTIONS = [
  { value: '', days: null },
  { value: 'COD', days: 0 },
  { value: 'Net 7', days: 7 },
  { value: 'Net 14', days: 14 },
  { value: 'Net 30', days: 30 },
  { value: 'Net 45', days: 45 },
  { value: 'Net 60', days: 60 },
  { value: '__custom__', days: null },
] as const;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function InvoiceForm({
  accounts,
  locations,
  partners,
}: {
  accounts: any[];
  locations: any[];
  partners: Partner[];
}) {
  const router = useRouter();
  const t = useTranslations('accounting.invoice');
  const tCommon = useTranslations('common.actions');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsMode, setTermsMode] = useState<'dropdown' | 'custom'>('dropdown');

  const [formData, setFormData] = useState({
    type: 'sales' as 'sales' | 'purchase',
    date: new Date().toISOString().slice(0, 10),
    dueDate: '',
    partnerId: '',
    partnerName: '',
    partnerAddress: '',
    partnerNpwp: '',
    paymentTerms: '',
    notes: '',
    locationId: locations[0]?.id || '',
  });

  const [lines, setLines] = useState<any[]>([
    { accountId: '', description: '', unit: '', quantity: 1, unitPrice: '0', taxRate: 0 },
  ]);

  const handlePartnerChange = (partnerId: string) => {
    const partner = partners.find((p) => p.id === partnerId);
    if (partner) {
      const terms = partner.paymentTermsDays;
      // Find matching dropdown option
      const matchedOption = TERMS_OPTIONS.find((o) => o.days === terms);
      const termsLabel = matchedOption ? matchedOption.value : terms ? `Net ${terms}` : '';

      setFormData((prev) => {
        const baseDate = prev.date || new Date().toISOString().slice(0, 10);
        const newDueDate =
          terms != null && terms > 0 ? addDays(baseDate, terms) : terms === 0 ? baseDate : '';
        return {
          ...prev,
          partnerId: partner.id,
          partnerName: partner.name,
          partnerAddress: partner.address ?? '',
          partnerNpwp: partner.npwp ?? '',
          paymentTerms: termsLabel,
          dueDate: newDueDate,
        };
      });

      if (matchedOption && matchedOption.value !== '__custom__') {
        setTermsMode('dropdown');
      } else if (terms) {
        setTermsMode('custom');
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        partnerId: '',
        partnerName: '',
        partnerAddress: '',
        partnerNpwp: '',
      }));
    }
  };

  const handleTermsChange = (value: string) => {
    if (value === '__custom__') {
      setTermsMode('custom');
      setFormData((prev) => ({ ...prev, paymentTerms: '' }));
      return;
    }
    setTermsMode('dropdown');
    const option = TERMS_OPTIONS.find((o) => o.value === value);
    const baseDate = formData.date || new Date().toISOString().slice(0, 10);
    const newDueDate = option?.days != null ? addDays(baseDate, option.days) : '';
    setFormData((prev) => ({
      ...prev,
      paymentTerms: value,
      dueDate: newDueDate,
    }));
  };

  const handleDateChange = (newDate: string) => {
    const option = TERMS_OPTIONS.find((o) => o.value === formData.paymentTerms);
    const newDueDate = option?.days != null ? addDays(newDate, option.days) : formData.dueDate;
    setFormData((prev) => ({ ...prev, date: newDate, dueDate: newDueDate }));
  };

  const addLine = () => {
    setLines([
      ...lines,
      { accountId: '', description: '', unit: '', quantity: 1, unitPrice: '0', taxRate: 0 },
    ]);
  };

  const updateLine = (index: number, field: string, value: string | number) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value } as any;
    setLines(newLines);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * Number(line.unitPrice), 0);
  const totalTax = lines.reduce((sum, line) => {
    const lineSubtotal = line.quantity * Number(line.unitPrice);
    return sum + Math.floor((lineSubtotal * line.taxRate) / 10000);
  }, 0);
  const grandTotal = subtotal + totalTax;

  const formatRp = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);

  const filteredPartners = partners.filter((p) =>
    formData.type === 'sales'
      ? p.kind === 'customer' || p.kind === 'other'
      : p.kind === 'supplier' || p.kind === 'other',
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        type: formData.type,
        date: formData.date,
        dueDate: formData.dueDate || null,
        partnerName: formData.partnerName,
        partnerAddress: formData.partnerAddress || null,
        partnerNpwp: formData.partnerNpwp || null,
        paymentTerms: formData.paymentTerms || null,
        notes: formData.notes || null,
        locationId: formData.locationId,
        lines: lines.map((line) => ({
          ...line,
          subtotal: (line.quantity * Number(line.unitPrice)).toString(),
          unitPrice: line.unitPrice,
        })),
      };

      await createInvoiceAction(payload);
      toast.success(tCommon('successSaved'));
      router.push('/accounting/invoices');
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
      className="space-y-8 rounded-xl border border-brand-cream-3 bg-card p-6 shadow-soft"
    >
      {error && (
        <div className="rounded-lg bg-brand-red-light p-4 text-sm text-brand-red">{error}</div>
      )}

      {/* Type selector */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 rounded-lg border border-brand-cream-3 px-4 py-3 cursor-pointer has-[:checked]:border-brand-red has-[:checked]:bg-brand-red/5">
          <input
            type="radio"
            name="type"
            value="sales"
            checked={formData.type === 'sales'}
            onChange={() => {
              setFormData((prev) => ({
                ...prev,
                type: 'sales',
                partnerId: '',
                partnerName: '',
                partnerAddress: '',
                partnerNpwp: '',
              }));
            }}
            className="accent-brand-red"
          />
          <span className="text-sm font-medium text-brand-ink">{t('new.typeSales')}</span>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-brand-cream-3 px-4 py-3 cursor-pointer has-[:checked]:border-brand-red has-[:checked]:bg-brand-red/5">
          <input
            type="radio"
            name="type"
            value="purchase"
            checked={formData.type === 'purchase'}
            onChange={() => {
              setFormData((prev) => ({
                ...prev,
                type: 'purchase',
                partnerId: '',
                partnerName: '',
                partnerAddress: '',
                partnerNpwp: '',
              }));
            }}
            className="accent-brand-red"
          />
          <span className="text-sm font-medium text-brand-ink">{t('new.typePurchase')}</span>
        </label>
      </div>

      {/* Partner & Date Section */}
      <div className="grid grid-cols-2 gap-6">
        {/* Partner selector */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('new.partnerName')}</label>
          <select
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
            value={formData.partnerId}
            onChange={(e) => handlePartnerChange(e.target.value)}
          >
            <option value="">{t('new.selectPartner')}</option>
            {filteredPartners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {formData.partnerId === '' && (
            <input
              type="text"
              placeholder={t('new.writePartnerName')}
              required
              className="mt-2 w-full rounded-lg border border-brand-cream-3 px-4 py-2"
              value={formData.partnerName}
              onChange={(e) => setFormData({ ...formData, partnerName: e.target.value })}
            />
          )}
        </div>

        {/* Partner Address */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">
            {t('new.partnerAddress')}
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
            value={formData.partnerAddress}
            onChange={(e) => setFormData({ ...formData, partnerAddress: e.target.value })}
          />
        </div>

        {/* NPWP */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('new.partnerNpwp')}</label>
          <input
            type="text"
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
            value={formData.partnerNpwp}
            onChange={(e) => setFormData({ ...formData, partnerNpwp: e.target.value })}
          />
        </div>

        {/* Location */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('new.location')}</label>
          <select
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
            value={formData.locationId}
            onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
          >
            {locations.map((l: any) => (
              <option key={l.id} value={l.id}>
                {l.label ?? l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('date')}</label>
          <input
            type="date"
            required
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
            value={formData.date}
            onChange={(e) => handleDateChange(e.target.value)}
          />
        </div>

        {/* Payment Terms — dropdown */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('new.paymentTerms')}</label>
          {termsMode === 'dropdown' ? (
            <select
              className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
              value={formData.paymentTerms}
              onChange={(e) => handleTermsChange(e.target.value)}
            >
              <option value="">{t('new.selectTerms')}</option>
              <option value="COD">{t('new.termsCod')}</option>
              <option value="Net 7">{t('new.termsNet7')}</option>
              <option value="Net 14">{t('new.termsNet14')}</option>
              <option value="Net 30">{t('new.termsNet30')}</option>
              <option value="Net 45">{t('new.termsNet45')}</option>
              <option value="Net 60">{t('new.termsNet60')}</option>
              <option value="__custom__">{t('new.termsCustom')}</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-lg border border-brand-cream-3 px-4 py-2"
                placeholder={t('new.paymentTermsPlaceholder')}
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              />
              <button
                type="button"
                onClick={() => {
                  setTermsMode('dropdown');
                  setFormData((prev) => ({ ...prev, paymentTerms: '' }));
                }}
                className="rounded-lg border border-brand-cream-3 px-3 py-2 text-xs text-brand-ink-3 hover:bg-brand-cream-1"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Due Date — auto-filled from terms, still editable */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('dueDate')}</label>
          <input
            type="date"
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink-3">{t('new.notesLabel')}</label>
          <input
            type="text"
            className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>
      </div>

      {/* Line Items */}
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
                  onChange={(e) => updateLine(idx, 'accountId', e.target.value)}
                >
                  <option value="">{t('new.selectAccount')}</option>
                  {accounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name?.id ?? acc.name?.en ?? acc.nameId ?? acc.nameEn}
                    </option>
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
                  onChange={(e) => updateLine(idx, 'description', e.target.value)}
                />
              </div>
              <div className="w-24 space-y-2">
                <input
                  type="text"
                  placeholder={t('new.unit')}
                  className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
                  value={line.unit}
                  onChange={(e) => updateLine(idx, 'unit', e.target.value)}
                />
              </div>
              <div className="w-24 space-y-2">
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
                  value={line.quantity}
                  onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                />
              </div>
              <div className="w-40 space-y-2">
                <input
                  type="number"
                  required
                  className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)}
                />
              </div>
              <div className="w-28 space-y-2">
                <select
                  className="w-full rounded-lg border border-brand-cream-3 px-4 py-2"
                  value={line.taxRate}
                  onChange={(e) => updateLine(idx, 'taxRate', Number(e.target.value))}
                >
                  <option value="0">{t('new.noTax')}</option>
                  <option value="1000">PB1 10%</option>
                  <option value="1100">PPN 11%</option>
                </select>
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

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-80 space-y-2 rounded-lg bg-brand-cream-1 p-4 border border-brand-cream-3">
          <div className="flex justify-between text-sm text-brand-ink-2">
            <span>{t('subtotal')}</span>
            <span className="font-mono">{formatRp(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-brand-ink-2">
            <span>{t('tax')}</span>
            <span className="font-mono">{formatRp(totalTax)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-brand-ink border-t border-brand-cream-3 pt-2">
            <span>{t('total')}</span>
            <span className="font-mono">{formatRp(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-brand-cream-2">
        <Button
          type="submit"
          disabled={loading}
          className="bg-brand-red hover:bg-brand-red-dark text-white"
        >
          {loading ? t('new.saving') : t('new.saveDraft')}
        </Button>
      </div>
    </form>
  );
}
