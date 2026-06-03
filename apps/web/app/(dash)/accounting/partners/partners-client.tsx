'use client';

import { Button, Input, Select, toast } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState, useTransition } from 'react';
import type { PartnerRow } from './actions';
import { savePartnerAction, togglePartnerAction } from './actions';

const KIND_OPTIONS = ['all', 'customer', 'supplier', 'employee', 'other'] as const;

interface Props {
  initialData: PartnerRow[];
  initialKind: string;
}

export function PartnersClient({ initialData, initialKind }: Props) {
  const t = useTranslations('accounting.partners');
  const tc = useTranslations('common.actions');
  const [kind, setKind] = useState(initialKind || 'all');
  const [editing, setEditing] = useState<PartnerRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const filtered =
    kind === 'all' ? initialData : initialData.filter((p) => p.kind === kind);

  return (
    <div className="space-y-6">
      {/* Kind filter tabs */}
      <div className="flex flex-wrap gap-2">
        {KIND_OPTIONS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              kind === k
                ? 'bg-brand-red text-white'
                : 'bg-brand-cream-2 text-brand-ink-2 hover:bg-brand-cream-3'
            }`}
          >
            {t(`kind.${k}`)}
          </button>
        ))}
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          {t('addPartner')}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <PartnerForm
          key={editing?.id || 'new'}
          initial={editing}
          defaultKind={kind === 'all' ? 'customer' : kind}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="border-b border-brand-cream-3 bg-brand-cream-1">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-brand-ink-2">
                {t('col.name')}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-brand-ink-2">
                {t('col.kind')}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-brand-ink-2">
                {t('col.contact')}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-brand-ink-2">
                NPWP
              </th>
              <th className="px-4 py-3 text-right font-semibold text-brand-ink-2">
                {t('col.termsDays')}
              </th>
              <th className="px-4 py-3 text-center font-semibold text-brand-ink-2">
                {t('col.status')}
              </th>
              <th className="px-4 py-3 text-right font-semibold text-brand-ink-2">
                {tc('edit')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-2">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-brand-ink-3"
                >
                  {t('empty')}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <PartnerTableRow
                  key={p.id}
                  partner={p}
                  onEdit={() => {
                    setEditing(p);
                    setShowForm(true);
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PartnerTableRow({
  partner,
  onEdit,
}: {
  partner: PartnerRow;
  onEdit: () => void;
}) {
  const t = useTranslations('accounting.partners');
  const [isPending, startTransition] = useTransition();

  return (
    <tr className="hover:bg-brand-cream-1/50">
      <td className="px-4 py-3 font-medium text-brand-ink">
        {partner.name}
        {partner.isPkp && (
          <span className="ml-2 rounded-full bg-brand-cream-2 px-2 py-0.5 text-[10px] font-semibold text-brand-ink-2">
            PKP
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-brand-ink-2 capitalize">
        {t(`kind.${partner.kind}`)}
      </td>
      <td className="px-4 py-3 text-brand-ink-2 text-xs">
        {[partner.email, partner.phone].filter(Boolean).join(' • ') || '—'}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-brand-ink-3">
        {partner.npwp || '—'}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-brand-ink">
        {partner.paymentTermsDays ?? 0}{' '}
        <span className="text-brand-ink-3">{t('days')}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await togglePartnerAction(partner.id);
              if (res.success) toast.success(t('toggled'));
            })
          }
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer ${
            partner.isActive
              ? 'bg-brand-jade/10 text-brand-jade'
              : 'bg-rose-50 text-rose-600'
          }`}
        >
          {partner.isActive ? t('active') : t('inactive')}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onEdit}
          className="text-sm font-medium text-brand-red hover:underline"
        >
          {t('edit')}
        </button>
      </td>
    </tr>
  );
}

function PartnerForm({
  initial,
  defaultKind,
  onDone,
}: {
  initial: PartnerRow | null;
  defaultKind: string;
  onDone: () => void;
}) {
  const t = useTranslations('accounting.partners');
  const tc = useTranslations('common.actions');
  const isEditing = !!initial;
  const [state, action, pending] = useActionState(savePartnerAction, {
    success: false,
  });

  useEffect(() => {
    if (state.success) {
      toast.success(isEditing ? t('updated') : t('created'));
      onDone();
    }
  }, [state.success, isEditing, onDone, t]);

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-brand-ink">
          {isEditing ? t('editPartner') : t('addPartner')}
        </h2>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-brand-ink-3 hover:text-brand-ink"
        >
          ✕
        </button>
      </div>

      {state.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      {isEditing && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">
            {t('col.kind')}
          </span>
          <Select
            name="kind"
            defaultValue={initial?.kind || defaultKind}
            className="h-9 w-full"
          >
            <option value="customer">{t('kind.customer')}</option>
            <option value="supplier">{t('kind.supplier')}</option>
            <option value="employee">{t('kind.employee')}</option>
            <option value="other">{t('kind.other')}</option>
          </Select>
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium text-brand-ink">
            {t('col.name')}
          </span>
          <Input
            name="name"
            required
            defaultValue={initial?.name || ''}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Email</span>
          <Input
            name="email"
            type="email"
            defaultValue={initial?.email || ''}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">
            {t('col.phone')}
          </span>
          <Input name="phone" defaultValue={initial?.phone || ''} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">NPWP</span>
          <Input name="npwp" defaultValue={initial?.npwp || ''} />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">
          {t('col.address')}
        </span>
        <textarea
          name="address"
          rows={2}
          className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm"
          defaultValue={initial?.address || ''}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">
            {t('col.termsDays')}
          </span>
          <Input
            name="paymentTermsDays"
            type="number"
            min="0"
            defaultValue={String(initial?.paymentTermsDays ?? 0)}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">
            {t('col.leadTime')}
          </span>
          <Input
            name="leadTimeDays"
            type="number"
            min="0"
            defaultValue={String(initial?.leadTimeDays ?? 0)}
          />
        </label>
        <label className="flex items-end gap-2 pb-1 text-sm font-medium text-brand-ink">
          <input
            name="isPkp"
            type="checkbox"
            defaultChecked={initial?.isPkp || false}
            className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
          />
          PKP
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          variant="primary"
          size="md"
          className="flex-1"
        >
          {pending ? tc('saving') : tc('save')}
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={onDone}
          variant="secondary"
          size="md"
        >
          {tc('cancel')}
        </Button>
      </div>
    </form>
  );
}
