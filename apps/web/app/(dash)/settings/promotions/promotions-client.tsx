'use client';

import type { PromotionListItem, UpsertPromotionInput } from '@erp/services/promotion';
import { useMemo, useState, useTransition } from 'react';
import { savePromotionAction } from './actions';

type LocationOption = { id: string; code: string; type: string; label: string };

interface Labels {
  add: string;
  save: string;
  saving: string;
  saved: string;
  code: string;
  nameId: string;
  nameEn: string;
  nameZh: string;
  kind: string;
  status: string;
  priority: string;
  startsAt: string;
  endsAt: string;
  locations: string;
  channels: string;
  conditions: string;
  benefits: string;
  stackable: string;
  requiresApproval: string;
  usageLimit: string;
  minSubtotal: string;
  minQty: string;
  memberOnly: string;
  percent: string;
  amount: string;
  buyQty: string;
  buyProductId: string;
  getQty: string;
  getProductId: string;
  getVariantId: string;
  discountPercent: string;
  expenseAccount: string;
  active: string;
  draft: string;
  paused: string;
  expired: string;
  percentDiscount: string;
  fixedDiscount: string;
  buyXGetY: string;
  freeItem: string;
  complimentary: string;
  allLocations: string;
}

interface Props {
  initialPromotions: PromotionListItem[];
  locations: LocationOption[];
  labels: Labels;
}

type PromotionDraft = {
  id?: string;
  code: string;
  nameId: string;
  nameEn: string;
  nameZh: string;
  kind: UpsertPromotionInput['kind'];
  status: UpsertPromotionInput['status'];
  priority: string;
  startsAt: string;
  endsAt: string;
  locationScope: string[];
  channelScope: string;
  minSubtotal: string;
  minQty: string;
  memberOnly: boolean;
  stackable: boolean;
  requiresApproval: boolean;
  usageLimit: string;
  percent: string;
  amount: string;
  buyQty: string;
  buyProductId: string;
  getQty: string;
  getProductId: string;
  getVariantId: string;
  discountPercent: string;
  expenseAccountCode: string;
};

const KIND_OPTIONS: Array<PromotionDraft['kind']> = [
  'percent_discount',
  'fixed_discount',
  'buy_x_get_y',
  'free_item',
  'complimentary',
];

const STATUS_OPTIONS: Array<PromotionDraft['status']> = ['draft', 'active', 'paused', 'expired'];

function nowLocalInput(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function isoToLocalInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function emptyDraft(): PromotionDraft {
  return {
    code: '',
    nameId: '',
    nameEn: '',
    nameZh: '',
    kind: 'percent_discount',
    status: 'draft',
    priority: '100',
    startsAt: nowLocalInput(),
    endsAt: '',
    locationScope: [],
    channelScope: 'walk_in, gofood, grabfood, shopeefood',
    minSubtotal: '',
    minQty: '',
    memberOnly: false,
    stackable: false,
    requiresApproval: false,
    usageLimit: '',
    percent: '',
    amount: '',
    buyQty: '',
    buyProductId: '',
    getQty: '',
    getProductId: '',
    getVariantId: '',
    discountPercent: '100',
    expenseAccountCode: '',
  };
}

function fromItem(item: PromotionListItem): PromotionDraft {
  return {
    id: item.id,
    code: item.code,
    nameId: item.name.id,
    nameEn: item.name.en,
    nameZh: item.name.zh,
    kind: item.kind,
    status: item.status,
    priority: String(item.priority),
    startsAt: isoToLocalInput(item.startsAt),
    endsAt: isoToLocalInput(item.endsAt),
    locationScope: item.locationScope,
    channelScope: item.channelScope.join(', '),
    minSubtotal: item.conditions.minSubtotal ?? '',
    minQty: item.conditions.minQty ? String(item.conditions.minQty) : '',
    memberOnly: item.conditions.memberOnly === true,
    stackable: item.stackable,
    requiresApproval: item.requiresApproval,
    usageLimit: item.usageLimit ? String(item.usageLimit) : '',
    percent: item.benefits.percentBps ? String(item.benefits.percentBps / 100) : '',
    amount: item.benefits.amount ?? '',
    buyQty: item.benefits.buyQty ? String(item.benefits.buyQty) : '',
    buyProductId: item.benefits.buyProductId ?? '',
    getQty: item.benefits.getQty ? String(item.benefits.getQty) : '',
    getProductId: item.benefits.getProductId ?? '',
    getVariantId: item.benefits.getVariantId ?? '',
    discountPercent: item.benefits.discountBps ? String(item.benefits.discountBps / 100) : '100',
    expenseAccountCode: item.benefits.expenseAccountCode ?? '',
  };
}

function tokenList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function percentToBps(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : undefined;
}

function toInput(draft: PromotionDraft): UpsertPromotionInput {
  return {
    id: draft.id,
    code: draft.code,
    name: {
      id: draft.nameId,
      en: draft.nameEn || draft.nameId,
      zh: draft.nameZh || draft.nameId,
    },
    kind: draft.kind,
    status: draft.status,
    priority: Number.parseInt(draft.priority || '100', 10),
    startsAt: new Date(draft.startsAt).toISOString(),
    endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
    locationScope: draft.locationScope,
    channelScope: tokenList(draft.channelScope),
    conditions: {
      ...(draft.minSubtotal ? { minSubtotal: draft.minSubtotal } : {}),
      ...(draft.minQty ? { minQty: Number.parseInt(draft.minQty, 10) } : {}),
      ...(draft.memberOnly ? { memberOnly: true } : {}),
    },
    benefits: {
      ...(percentToBps(draft.percent) !== undefined
        ? { percentBps: percentToBps(draft.percent) }
        : {}),
      ...(draft.amount ? { amount: draft.amount } : {}),
      ...(draft.buyQty ? { buyQty: Number.parseInt(draft.buyQty, 10) } : {}),
      ...(draft.buyProductId ? { buyProductId: draft.buyProductId } : {}),
      ...(draft.getQty ? { getQty: Number.parseInt(draft.getQty, 10) } : {}),
      ...(draft.getProductId ? { getProductId: draft.getProductId } : {}),
      ...(draft.getVariantId ? { getVariantId: draft.getVariantId } : {}),
      ...(percentToBps(draft.discountPercent) !== undefined
        ? { discountBps: percentToBps(draft.discountPercent) }
        : {}),
      ...(draft.expenseAccountCode ? { expenseAccountCode: draft.expenseAccountCode } : {}),
      appliesTo:
        draft.kind === 'percent_discount' || draft.kind === 'fixed_discount' ? 'order' : undefined,
      requiresReason: draft.kind === 'complimentary' ? true : undefined,
    },
    stackable: draft.stackable,
    requiresApproval: draft.requiresApproval,
    usageLimit: draft.usageLimit ? Number.parseInt(draft.usageLimit, 10) : null,
  };
}

export function PromotionsClient({ initialPromotions, locations, labels }: Props) {
  const [items, setItems] = useState(initialPromotions);
  const [draft, setDraft] = useState<PromotionDraft>(emptyDraft());
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedLocationNames = useMemo(() => {
    if (draft.locationScope.length === 0) return labels.allLocations;
    return draft.locationScope
      .map((id) => locations.find((location) => location.id === id)?.label ?? id)
      .join(', ');
  }, [draft.locationScope, labels.allLocations, locations]);

  function update(patch: Partial<PromotionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function toggleLocation(id: string) {
    setDraft((current) => ({
      ...current,
      locationScope: current.locationScope.includes(id)
        ? current.locationScope.filter((item) => item !== id)
        : [...current.locationScope, id],
    }));
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await savePromotionAction(toInput(draft));
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setItems((current) => {
        const without = current.filter((item) => item.id !== result.item.id);
        return [result.item, ...without];
      });
      setDraft(fromItem(result.item));
      setMessage(labels.saved);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-brand-cream-3 bg-card">
        <div className="border-b border-brand-cream-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setDraft(emptyDraft())}
            className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
          >
            {labels.add}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[840px] w-full text-sm">
            <thead className="bg-brand-cream-2 text-left text-xs uppercase tracking-widest text-brand-ink-3">
              <tr>
                <th className="px-4 py-3">{labels.code}</th>
                <th className="px-4 py-3">{labels.kind}</th>
                <th className="px-4 py-3">{labels.status}</th>
                <th className="px-4 py-3">{labels.startsAt}</th>
                <th className="px-4 py-3">{labels.locations}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer hover:bg-brand-cream-1"
                  onClick={() => setDraft(fromItem(item))}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-brand-ink">{item.code}</div>
                    <div className="text-xs text-brand-ink-3">{item.name.id}</div>
                  </td>
                  <td className="px-4 py-3 text-brand-ink-2">{labelsForKind(item.kind, labels)}</td>
                  <td className="px-4 py-3 text-brand-ink-2">
                    {labelsForStatus(item.status, labels)}
                  </td>
                  <td className="px-4 py-3 text-brand-ink-2">
                    {new Date(item.startsAt).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-brand-ink-2">
                    {item.locationScope.length === 0
                      ? labels.allLocations
                      : item.locationScope
                          .map(
                            (id) => locations.find((location) => location.id === id)?.label ?? id,
                          )
                          .join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="space-y-4 rounded-lg border border-brand-cream-3 bg-card p-4">
        <Field label={labels.code} value={draft.code} onChange={(code) => update({ code })} />
        <Field
          label={labels.nameId}
          value={draft.nameId}
          onChange={(nameId) => update({ nameId })}
        />
        <Field
          label={labels.nameEn}
          value={draft.nameEn}
          onChange={(nameEn) => update({ nameEn })}
        />
        <Field
          label={labels.nameZh}
          value={draft.nameZh}
          onChange={(nameZh) => update({ nameZh })}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label={labels.kind}
            value={draft.kind}
            options={KIND_OPTIONS.map((value) => ({ value, label: labelsForKind(value, labels) }))}
            onChange={(kind) => update({ kind: kind as PromotionDraft['kind'] })}
          />
          <Select
            label={labels.status}
            value={draft.status}
            options={STATUS_OPTIONS.map((value) => ({
              value,
              label: labelsForStatus(value, labels),
            }))}
            onChange={(status) => update({ status: status as PromotionDraft['status'] })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={labels.priority}
            value={draft.priority}
            onChange={(priority) => update({ priority })}
          />
          <Field
            label={labels.usageLimit}
            value={draft.usageLimit}
            onChange={(usageLimit) => update({ usageLimit })}
          />
        </div>

        <Field
          label={labels.startsAt}
          value={draft.startsAt}
          type="datetime-local"
          onChange={(startsAt) => update({ startsAt })}
        />
        <Field
          label={labels.endsAt}
          value={draft.endsAt}
          type="datetime-local"
          onChange={(endsAt) => update({ endsAt })}
        />

        <div>
          <div className="mb-1 text-xs font-medium text-brand-ink-3">{labels.locations}</div>
          <div className="mb-2 rounded-md bg-brand-cream-1 px-3 py-2 text-xs text-brand-ink-2">
            {selectedLocationNames}
          </div>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-brand-cream-3 p-2">
            {locations.map((location) => (
              <label key={location.id} className="flex items-center gap-2 text-xs text-brand-ink-2">
                <input
                  type="checkbox"
                  checked={draft.locationScope.includes(location.id)}
                  onChange={() => toggleLocation(location.id)}
                />
                {location.label}
              </label>
            ))}
          </div>
        </div>

        <Field
          label={labels.channels}
          value={draft.channelScope}
          onChange={(channelScope) => update({ channelScope })}
        />

        <div className="rounded-md border border-brand-cream-3 p-3">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-ink-3">
            {labels.conditions}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={labels.minSubtotal}
              value={draft.minSubtotal}
              onChange={(minSubtotal) => update({ minSubtotal })}
            />
            <Field
              label={labels.minQty}
              value={draft.minQty}
              onChange={(minQty) => update({ minQty })}
            />
          </div>
          <Checkbox
            label={labels.memberOnly}
            checked={draft.memberOnly}
            onChange={(memberOnly) => update({ memberOnly })}
          />
        </div>

        <div className="rounded-md border border-brand-cream-3 p-3">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-ink-3">
            {labels.benefits}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={labels.percent}
              value={draft.percent}
              onChange={(percent) => update({ percent })}
            />
            <Field
              label={labels.amount}
              value={draft.amount}
              onChange={(amount) => update({ amount })}
            />
            <Field
              label={labels.buyQty}
              value={draft.buyQty}
              onChange={(buyQty) => update({ buyQty })}
            />
            <Field
              label={labels.buyProductId}
              value={draft.buyProductId}
              onChange={(buyProductId) => update({ buyProductId })}
            />
            <Field
              label={labels.getQty}
              value={draft.getQty}
              onChange={(getQty) => update({ getQty })}
            />
            <Field
              label={labels.getProductId}
              value={draft.getProductId}
              onChange={(getProductId) => update({ getProductId })}
            />
            <Field
              label={labels.getVariantId}
              value={draft.getVariantId}
              onChange={(getVariantId) => update({ getVariantId })}
            />
            <Field
              label={labels.discountPercent}
              value={draft.discountPercent}
              onChange={(discountPercent) => update({ discountPercent })}
            />
          </div>
          <Field
            label={labels.expenseAccount}
            value={draft.expenseAccountCode}
            onChange={(expenseAccountCode) => update({ expenseAccountCode })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Checkbox
            label={labels.stackable}
            checked={draft.stackable}
            onChange={(stackable) => update({ stackable })}
          />
          <Checkbox
            label={labels.requiresApproval}
            checked={draft.requiresApproval}
            onChange={(requiresApproval) => update({ requiresApproval })}
          />
        </div>

        {message && (
          <div className="rounded-md bg-brand-cream-1 px-3 py-2 text-sm text-brand-ink-2">
            {message}
          </div>
        )}

        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className="h-11 w-full rounded-md bg-brand-red text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-60"
        >
          {isPending ? labels.saving : labels.save}
        </button>
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  type = 'text',
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-brand-ink-3">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 text-sm text-brand-ink"
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-brand-ink-3">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-sm text-brand-ink"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="mt-3 flex items-center gap-2 text-xs font-medium text-brand-ink-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function labelsForKind(kind: PromotionDraft['kind'], labels: Labels): string {
  return {
    percent_discount: labels.percentDiscount,
    fixed_discount: labels.fixedDiscount,
    buy_x_get_y: labels.buyXGetY,
    free_item: labels.freeItem,
    complimentary: labels.complimentary,
  }[kind];
}

function labelsForStatus(status: PromotionDraft['status'], labels: Labels): string {
  return {
    draft: labels.draft,
    active: labels.active,
    paused: labels.paused,
    expired: labels.expired,
  }[status];
}
