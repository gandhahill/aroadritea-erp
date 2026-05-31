'use client';

import { toast } from '@erp/ui';
import type { PostingAccountPurpose } from '@erp/services/accounting';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { saveAccountMapAction } from './actions';

type GroupKey = 'pos' | 'inventory' | 'purchasing' | 'cash' | 'payroll' | 'other';

const GROUP_ORDER: GroupKey[] = ['pos', 'inventory', 'purchasing', 'cash', 'payroll', 'other'];

// Typed by PostingAccountPurpose so TS flags any purpose we forget to surface.
const PURPOSE_META: Record<PostingAccountPurpose, { group: GroupKey; labelKey: string }> = {
  'pos.cash': { group: 'pos', labelKey: 'posCash' },
  'pos.revenue': { group: 'pos', labelKey: 'posRevenue' },
  'pos.donationTrust': { group: 'pos', labelKey: 'posDonationTrust' },
  cogs: { group: 'inventory', labelKey: 'cogs' },
  inventory: { group: 'inventory', labelKey: 'inventory' },
  'adjustment.expense': { group: 'inventory', labelKey: 'adjustmentExpense' },
  'adjustment.income': { group: 'inventory', labelKey: 'adjustmentIncome' },
  'purchasing.grni': { group: 'purchasing', labelKey: 'purchasingGrni' },
  'purchasing.ap': { group: 'purchasing', labelKey: 'purchasingAp' },
  'purchasing.vatIn': { group: 'purchasing', labelKey: 'purchasingVatIn' },
  pettyCash: { group: 'cash', labelKey: 'pettyCash' },
  cash: { group: 'cash', labelKey: 'cash' },
  bank: { group: 'cash', labelKey: 'bank' },
  'payroll.salaryExpense': { group: 'payroll', labelKey: 'payrollSalaryExpense' },
  'payroll.taxPayable': { group: 'payroll', labelKey: 'payrollTaxPayable' },
  'payroll.bpjsPayable': { group: 'payroll', labelKey: 'payrollBpjsPayable' },
  'payroll.netPay': { group: 'payroll', labelKey: 'payrollNetPay' },
  'refund.expense': { group: 'other', labelKey: 'refundExpense' },
  'fixedAsset.gainOnDisposal': { group: 'other', labelKey: 'fixedAssetGain' },
  'period.incomeSummary': { group: 'other', labelKey: 'periodIncomeSummary' },
  'period.retainedEarnings': { group: 'other', labelKey: 'periodRetainedEarnings' },
  'equity.opening': { group: 'other', labelKey: 'equityOpening' },
};

interface AccountOption {
  code: string;
  label: string;
}

export function AccountMappingForm({
  accounts,
  current,
  defaults,
  missingCurrent,
}: {
  accounts: AccountOption[];
  current: Record<string, string>;
  defaults: Record<string, string>;
  missingCurrent: string[];
}) {
  const t = useTranslations('settings.accounting');
  const tc = useTranslations('common');
  const [map, setMap] = useState<Record<string, string>>(current);
  const [pending, startTransition] = useTransition();
  const missingSet = useMemo(() => new Set(missingCurrent), [missingCurrent]);

  const grouped = useMemo(() => {
    const out: Record<GroupKey, PostingAccountPurpose[]> = {
      pos: [],
      inventory: [],
      purchasing: [],
      cash: [],
      payroll: [],
      other: [],
    };
    for (const purpose of Object.keys(PURPOSE_META) as PostingAccountPurpose[]) {
      out[PURPOSE_META[purpose].group].push(purpose);
    }
    return out;
  }, []);

  function setPurpose(purpose: string, code: string) {
    setMap((prev) => ({ ...prev, [purpose]: code }));
  }

  function save() {
    startTransition(async () => {
      const res = await saveAccountMapAction(map);
      if (res.ok) toast.success(t('saved'));
      else toast.error(res.error ?? t('saveFailed'));
    });
  }

  function optionsFor(currentCode: string): AccountOption[] {
    // Ensure the current value is always selectable, even if it points at an
    // account that is missing/inactive in this database (stale config).
    if (currentCode && !accounts.some((a) => a.code === currentCode)) {
      return [{ code: currentCode, label: `${currentCode} — ${t('notFound')}` }, ...accounts];
    }
    return accounts;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand-jade/20 bg-brand-jade-light/40 px-4 py-3 text-sm text-brand-ink">
        <p>{t('hint')}</p>
      </div>

      {missingCurrent.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('missingWarning')}
        </div>
      ) : null}

      {GROUP_ORDER.map((group) => (
        <section
          key={group}
          className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm"
        >
          <div className="border-b border-brand-cream-3 bg-brand-cream-1 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-red">
              {t(`groups.${group}`)}
            </h2>
          </div>
          <div className="divide-y divide-brand-cream-3">
            {grouped[group].map((purpose) => {
              const value = map[purpose] ?? '';
              const def = defaults[purpose] ?? '';
              const isDefault = value === def;
              return (
                <div
                  key={purpose}
                  className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 sm:w-1/2">
                    <p className="text-sm font-medium text-brand-ink">
                      {t(`purposes.${PURPOSE_META[purpose].labelKey}`)}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-brand-ink-3">
                      <code className="font-mono">{purpose}</code>
                      {!isDefault ? (
                        <button
                          type="button"
                          onClick={() => setPurpose(purpose, def)}
                          className="rounded border border-brand-cream-3 px-1.5 py-0.5 font-medium text-brand-ink-2 hover:border-brand-red/40 hover:text-brand-red"
                        >
                          {t('resetToDefault', { code: def })}
                        </button>
                      ) : (
                        <span>{t('defaultLabel', { code: def })}</span>
                      )}
                    </p>
                  </div>
                  <select
                    value={value}
                    onChange={(e) => setPurpose(purpose, e.target.value)}
                    className={`h-9 w-full rounded-md border bg-card px-2.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none sm:w-1/2 ${
                      missingSet.has(purpose) ? 'border-amber-400' : 'border-brand-cream-3'
                    }`}
                  >
                    {optionsFor(value).map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
        >
          {pending ? tc('actions.saving') : tc('actions.save')}
        </button>
      </div>
    </div>
  );
}
