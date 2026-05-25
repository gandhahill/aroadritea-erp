import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';

import {
  deleteTaxRateAction,
  fetchTaxAccountOptions,
  fetchTaxRates,
  saveTaxRateAction,
} from './actions';

export const metadata: Metadata = {
  title: 'Tax Rates - Aroadri ERP',
};

import { PageHeader } from '@/components/page-header';
import { Button, Select, TableCell, TableHead } from '@erp/ui';
import { getTranslations } from 'next-intl/server';

function formatDate(value: string | null, locale: string) {
  if (!value) return '-';
  const intlLocale = locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'id-ID';
  return new Intl.DateTimeFormat(intlLocale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function pickName(name: Record<string, string>, locale: string) {
  return name[locale] ?? name.id ?? name.en ?? name.zh ?? '-';
}

export default async function TaxRatesPage() {
  const locale = await getLocale();
  const t = await getTranslations('tax.rates');
  const [rows, accountOptions] = await Promise.all([
    fetchTaxRates(locale),
    fetchTaxAccountOptions(locale),
  ]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-6">
        <PageHeader
          title={<>{t('title')}</>}
          description={<>{t('subtitle')}</>}
          eyebrow={<>Tax</>}
        />

        <form
          action={saveTaxRateAction}
          className="grid gap-3 rounded-lg border border-brand-ink/10 bg-brand-porcelain p-4 md:grid-cols-4"
        >
          <input
            name="code"
            placeholder="PBJT"
            className="rounded border border-brand-ink/10 bg-card px-3 py-2 text-sm"
          />
          <input
            name="nameId"
            placeholder="Nama ID"
            className="rounded border border-brand-ink/10 bg-card px-3 py-2 text-sm"
          />
          <input
            name="nameEn"
            placeholder="Name EN"
            className="rounded border border-brand-ink/10 bg-card px-3 py-2 text-sm"
          />
          <input
            name="nameZh"
            placeholder="中文名称"
            className="rounded border border-brand-ink/10 bg-card px-3 py-2 text-sm"
          />
          <input
            name="ratePercent"
            type="number"
            step="0.01"
            placeholder="10"
            className="rounded border border-brand-ink/10 bg-card px-3 py-2 text-sm"
          />
          <Select
            name="calculation"
            className="rounded border border-brand-ink/10 bg-card px-3 py-2 text-sm"
          >
            <option value="inclusive">{t('inclusive')}</option>
            <option value="exclusive">{t('exclusive')}</option>
          </Select>
          <Select
            name="postingAccountId"
            className="rounded border border-brand-ink/10 bg-card px-3 py-2 text-sm"
          >
            <option value="">{t('selectAccount')}</option>
            {accountOptions.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </Select>
          <input
            name="effectiveFrom"
            type="date"
            className="rounded border border-brand-ink/10 bg-card px-3 py-2 text-sm"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
          <input
            name="effectiveUntil"
            type="date"
            className="rounded border border-brand-ink/10 bg-card px-3 py-2 text-sm"
          />
          <label className="inline-flex items-center gap-2 text-sm text-brand-muted">
            <input name="isActive" type="checkbox" defaultChecked />
            {t('active')}
          </label>
          <Button
            type="submit"
            className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red/90"
            variant="primary"
            size="md"
          >
            {t('create')}
          </Button>
        </form>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-brand-ink/10 bg-brand-porcelain p-6 text-sm text-brand-muted">
            {t('empty')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-brand-ink/10 bg-brand-porcelain">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-brand-ink/10 bg-brand-paper/70 text-xs uppercase tracking-[0.14em] text-brand-muted">
                  <tr>
                    <TableHead className="px-4 py-3 font-semibold">{t('code')}</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">{t('name')}</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">{t('rate')}</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">{t('calculation')}</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">{t('account')}</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">{t('effective')}</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">{t('status')}</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">{t('actions')}</TableHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-ink/10">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-brand-paper/70">
                      <TableCell className="px-4 py-3 font-mono text-xs font-semibold text-brand-red">
                        {row.code}
                      </TableCell>
                      <TableCell className="px-4 py-3 font-semibold text-brand-ink">
                        {pickName(row.name, locale)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-brand-muted">
                        {row.ratePercent}%
                      </TableCell>
                      <TableCell className="px-4 py-3 text-brand-muted">
                        {row.calculation === 'inclusive' ? t('inclusive') : t('exclusive')}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-brand-muted">
                        {row.postingAccount}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-brand-muted">
                        {formatDate(row.effectiveFrom, locale)} -{' '}
                        {formatDate(row.effectiveUntil, locale)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            row.isActive
                              ? 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade'
                              : 'border-brand-ink/15 bg-brand-ink/5 text-brand-muted'
                          }`}
                        >
                          {row.isActive ? t('active') : t('inactive')}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <details className="group">
                          <summary className="cursor-pointer text-xs font-semibold text-brand-red">
                            {t('edit')}
                          </summary>
                          <form action={saveTaxRateAction} className="mt-3 grid min-w-96 gap-2">
                            <input type="hidden" name="id" value={row.id} />
                            <input
                              name="code"
                              defaultValue={row.code}
                              className="rounded border border-brand-ink/10 bg-card px-2 py-1 text-xs"
                            />
                            <input
                              name="nameId"
                              defaultValue={row.name.id ?? ''}
                              className="rounded border border-brand-ink/10 bg-card px-2 py-1 text-xs"
                            />
                            <input
                              name="nameEn"
                              defaultValue={row.name.en ?? ''}
                              className="rounded border border-brand-ink/10 bg-card px-2 py-1 text-xs"
                            />
                            <input
                              name="nameZh"
                              defaultValue={row.name.zh ?? ''}
                              className="rounded border border-brand-ink/10 bg-card px-2 py-1 text-xs"
                            />
                            <input
                              name="ratePercent"
                              type="number"
                              step="0.01"
                              defaultValue={row.ratePercent}
                              className="rounded border border-brand-ink/10 bg-card px-2 py-1 text-xs"
                            />
                            <Select
                              name="calculation"
                              defaultValue={row.calculation}
                              className="rounded border border-brand-ink/10 bg-card px-2 py-1 text-xs"
                            >
                              <option value="inclusive">{t('inclusive')}</option>
                              <option value="exclusive">{t('exclusive')}</option>
                            </Select>
                            <Select
                              name="postingAccountId"
                              defaultValue={row.postingAccountId}
                              className="rounded border border-brand-ink/10 bg-card px-2 py-1 text-xs"
                            >
                              {accountOptions.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.label}
                                </option>
                              ))}
                            </Select>
                            <input
                              name="effectiveFrom"
                              type="date"
                              defaultValue={row.effectiveFrom}
                              className="rounded border border-brand-ink/10 bg-card px-2 py-1 text-xs"
                            />
                            <input
                              name="effectiveUntil"
                              type="date"
                              defaultValue={row.effectiveUntil ?? ''}
                              className="rounded border border-brand-ink/10 bg-card px-2 py-1 text-xs"
                            />
                            <label className="inline-flex items-center gap-2 text-xs text-brand-muted">
                              <input
                                name="isActive"
                                type="checkbox"
                                defaultChecked={row.isActive}
                              />
                              {t('active')}
                            </label>
                            <Button
                              type="submit"
                              className="rounded bg-brand-red px-3 py-1.5 text-xs font-semibold text-white"
                              variant="primary"
                              size="sm"
                            >
                              {t('save')}
                            </Button>
                          </form>
                          <form action={deleteTaxRateAction} className="mt-2">
                            <input type="hidden" name="id" value={row.id} />
                            <button type="submit" className="text-xs font-semibold text-brand-red">
                              {t('deactivate')}
                            </button>
                          </form>
                        </details>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
