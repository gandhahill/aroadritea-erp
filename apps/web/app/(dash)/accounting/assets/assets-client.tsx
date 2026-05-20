'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { createAssetAction, runDepreciationAction, updateAssetCategoryAction } from './actions';
import type { AssetPageData } from './actions';

const INPUT =
  'w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5';

const METHOD_VALUES = [
  'straight_line',
  'declining_balance',
  'double_declining_balance',
  'sum_of_years_digits',
  'units_of_production',
] as const;

interface Props extends AssetPageData {
  initialLocationId: string;
  initialStatus: string;
  today: string;
}

export function AssetsClient({
  assets,
  total,
  categories,
  locations,
  accountOptions,
  initialLocationId,
  initialStatus,
  today,
}: Props) {
  const t = useTranslations('accounting.assets');
  const locale = useLocale();
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState(createAssetAction, null);
  const [runState, runAction, runPending] = useActionState(runDepreciationAction, null);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? categories[0],
    [categories, categoryId],
  );
  const fixedAssetAccounts = useMemo(
    () =>
      accountOptions.filter(
        (account) => account.type === 'asset' && account.subtype === 'fixed_asset',
      ),
    [accountOptions],
  );
  const accumulatedAccounts = useMemo(
    () =>
      accountOptions.filter(
        (account) => account.type === 'asset' && account.subtype === 'contra_asset',
      ),
    [accountOptions],
  );
  const depreciationExpenseAccounts = useMemo(
    () => accountOptions.filter((account) => account.type === 'expense'),
    [accountOptions],
  );

  useEffect(() => {
    if (!createState?.ok) return;
    router.refresh();
  }, [createState, router]);

  useEffect(() => {
    if (!runState?.ok) return;
    router.refresh();
  }, [runState, router]);

  const formatMoney = (value: string) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(value));

  const pickName = (name: Record<string, string>) =>
    name[locale] ?? name.id ?? name.en ?? name.zh ?? '';

  const applyFilter = (locationId: string, status: string) => {
    const params = new URLSearchParams();
    if (locationId) params.set('locationId', locationId);
    if (status) params.set('status', status);
    router.push(`/accounting/assets${params.size > 0 ? '?' + params.toString() : ''}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.8fr)]">
        <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-brand-ink">{t('register')}</h2>
              <p className="mt-1 text-sm text-brand-ink-3">{t('registerDescription')}</p>
            </div>
            <span className="rounded-full bg-brand-cream-2 px-3 py-1 text-xs font-medium text-brand-ink-2">
              {t('count', { count: total })}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              value={initialLocationId}
              onChange={(event) => applyFilter(event.target.value, initialStatus)}
              className={INPUT}
            >
              <option value="">{t('allLocations')}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </select>
            <select
              value={initialStatus}
              onChange={(event) => applyFilter(initialLocationId, event.target.value)}
              className={INPUT}
            >
              <option value="">{t('allStatuses')}</option>
              <option value="active">{t('statusActive')}</option>
              <option value="fully_depreciated">{t('statusFullyDepreciated')}</option>
              <option value="disposed">{t('statusDisposed')}</option>
            </select>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-brand-cream-3">
            <table className="w-full text-sm">
              <thead className="bg-brand-cream-1 text-left text-brand-ink-2">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('asset')}</th>
                  <th className="px-3 py-2 font-medium">{t('location')}</th>
                  <th className="px-3 py-2 font-medium">{t('method')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('cost')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('accumulated')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('bookValue')}</th>
                  <th className="px-3 py-2 font-medium">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-cream-2">
                {assets.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-brand-ink-3" colSpan={7}>
                      {t('empty')}
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => {
                    const location = locations.find((item) => item.id === asset.locationId);
                    return (
                      <tr key={asset.id} className="align-top hover:bg-brand-cream-1/40">
                        <td className="px-3 py-3">
                          <div className="font-medium text-brand-ink">{asset.name}</div>
                          <div className="mt-0.5 text-xs text-brand-ink-3">
                            {asset.code} - {pickName(asset.categoryName)}
                          </div>
                          <div className="mt-0.5 text-xs text-brand-ink-3">
                            {asset.inServiceDate} - {asset.usefulLifeMonths} {t('months')}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-brand-ink-2">
                          {location?.label ?? asset.locationId}
                        </td>
                        <td className="px-3 py-3 text-brand-ink-2">
                          {t(`methods.${asset.depreciationMethod}`)}
                        </td>
                        <td className="px-3 py-3 text-right text-brand-ink">
                          {formatMoney(asset.acquisitionCost)}
                        </td>
                        <td className="px-3 py-3 text-right text-brand-ink">
                          {formatMoney(asset.accumulatedDepreciation)}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-brand-ink">
                          {formatMoney(asset.bookValue)}
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-brand-jade/10 px-2 py-0.5 text-xs font-medium text-brand-jade">
                            {t(`statuses.${asset.status}`)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <form
            action={runAction}
            className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-brand-ink">{t('runTitle')}</h2>
            <p className="mt-1 text-sm text-brand-ink-3">{t('runDescription')}</p>
            {runState?.error ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {runState.error}
              </div>
            ) : null}
            {runState?.ok ? (
              <div className="mt-4 rounded-lg border border-brand-jade/20 bg-brand-jade/10 px-3 py-2 text-sm text-brand-jade">
                {t('runSuccess', { amount: formatMoney(runState.totalAmount ?? '0') })}{' '}
                <Link
                  href={`/accounting/journals/${runState.journalEntryId}`}
                  className="underline"
                >
                  {t('openJournal')}
                </Link>
              </div>
            ) : null}
            <div className="mt-4 space-y-3">
              <SelectLocation name="locationId" locations={locations} label={t('location')} />
              <Field
                label={t('postingDate')}
                name="postingDate"
                type="date"
                defaultValue={today}
                required
              />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-brand-ink">{t('notes')}</span>
                <textarea name="notes" className={`${INPUT} min-h-20`} />
              </label>
              <button
                type="submit"
                disabled={runPending || locations.length === 0}
                className="w-full rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
              >
                {runPending ? t('posting') : t('run')}
              </button>
            </div>
          </form>
        </aside>
      </div>

      <form
        action={createAction}
        className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm"
      >
        <div>
          <h2 className="text-base font-semibold text-brand-ink">{t('createTitle')}</h2>
          <p className="mt-1 text-sm text-brand-ink-3">{t('createDescription')}</p>
        </div>
        {createState?.error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {createState.error}
          </div>
        ) : null}
        {createState?.ok ? (
          <div className="mt-4 rounded-lg border border-brand-jade/20 bg-brand-jade/10 px-3 py-2 text-sm text-brand-jade">
            {t('createSuccess')}
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectLocation name="locationId" locations={locations} label={t('location')} />
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{t('category')}</span>
            <select
              name="categoryId"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
              className={INPUT}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {pickName(category.name)}
                </option>
              ))}
            </select>
          </label>
          <Field label={t('code')} name="code" required />
          <Field label={t('name')} name="name" required />
          <Field
            label={t('acquisitionDate')}
            name="acquisitionDate"
            type="date"
            defaultValue={today}
            required
          />
          <Field
            label={t('inServiceDate')}
            name="inServiceDate"
            type="date"
            defaultValue={today}
            required
          />
          <Field label={t('acquisitionCost')} name="acquisitionCost" inputMode="numeric" required />
          <Field
            label={t('salvageValue')}
            name="salvageValue"
            inputMode="numeric"
            defaultValue="0"
          />
          <Field
            label={t('usefulLifeMonths')}
            name="usefulLifeMonths"
            type="number"
            defaultValue={String(selectedCategory?.defaultUsefulLifeMonths ?? 48)}
            required
          />
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{t('method')}</span>
            <select
              name="depreciationMethod"
              defaultValue={selectedCategory?.defaultDepreciationMethod ?? 'straight_line'}
              className={INPUT}
            >
              {METHOD_VALUES.map((method) => (
                <option key={method} value={method}>
                  {t(`methods.${method}`)}
                </option>
              ))}
            </select>
          </label>
          <Field label={t('rateBps')} name="depreciationRateBps" type="number" placeholder="2500" />
          <Field label={t('productionCapacity')} name="productionCapacity" inputMode="numeric" />
          <label className="space-y-1.5 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-brand-ink">{t('notes')}</span>
            <textarea name="notes" className={`${INPUT} min-h-20`} />
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={createPending || categories.length === 0 || locations.length === 0}
            className="rounded-lg bg-brand-red px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
          >
            {createPending ? t('saving') : t('save')}
          </button>
        </div>
      </form>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-brand-ink">{t('categorySettings')}</h2>
          <p className="mt-1 text-sm text-brand-ink-3">{t('categorySettingsDescription')}</p>
        </div>
        <div className="mt-5 space-y-3">
          {categories.map((category) => (
            <form
              key={category.id}
              action={updateAssetCategoryAction}
              className="grid gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-3 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_1fr_1fr_1fr_auto]"
            >
              <input type="hidden" name="categoryId" value={category.id} />
              <div>
                <div className="font-semibold text-brand-ink">{pickName(category.name)}</div>
                <div className="mt-0.5 text-xs text-brand-ink-3">{category.code}</div>
              </div>
              <label className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-3">
                  {t('usefulLifeMonths')}
                </span>
                <input
                  name="defaultUsefulLifeMonths"
                  type="number"
                  min={1}
                  max={600}
                  defaultValue={category.defaultUsefulLifeMonths}
                  className={INPUT}
                />
              </label>
              <SelectAccount
                label={t('assetAccount')}
                name="assetAccountId"
                accounts={fixedAssetAccounts}
                defaultValue={category.assetAccountId}
                pickName={pickName}
              />
              <SelectAccount
                label={t('accumulatedAccount')}
                name="accumulatedDepreciationAccountId"
                accounts={accumulatedAccounts}
                defaultValue={category.accumulatedDepreciationAccountId}
                pickName={pickName}
              />
              <SelectAccount
                label={t('expenseAccount')}
                name="depreciationExpenseAccountId"
                accounts={depreciationExpenseAccounts}
                defaultValue={category.depreciationExpenseAccountId}
                pickName={pickName}
              />
              <div className="grid gap-2 md:col-span-2 xl:col-span-1">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-brand-ink-3">
                    {t('defaultMethod')}
                  </span>
                  <select
                    name="defaultDepreciationMethod"
                    defaultValue={category.defaultDepreciationMethod}
                    className={INPUT}
                  >
                    {METHOD_VALUES.map((method) => (
                      <option key={method} value={method}>
                        {t(`methods.${method}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark"
                >
                  {t('saveCategory')}
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}

function SelectAccount({
  label,
  name,
  accounts,
  defaultValue,
  pickName,
}: {
  label: string;
  name: string;
  accounts: Array<{ id: string; code: string; name: Record<string, string> }>;
  defaultValue: string;
  pickName: (name: Record<string, string>) => string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-brand-ink-3">{label}</span>
      <select name={name} defaultValue={defaultValue} className={INPUT}>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.code} - {pickName(account.name)}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectLocation({
  label,
  name,
  locations,
}: {
  label: string;
  name: string;
  locations: Array<{ id: string; label: string }>;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium text-brand-ink">{label}</span>
      <select name={name} required defaultValue={locations[0]?.id ?? ''} className={INPUT}>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
  placeholder,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  inputMode?: 'numeric';
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium text-brand-ink">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        inputMode={inputMode}
        className={INPUT}
      />
    </label>
  );
}
