import { PageHeader } from '@/components/page-header';
import { Button, Select, Table, TableBody, TableCell, TableHead, TableHeader } from '@erp/ui';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  deleteTaxRuleAction,
  fetchTaxRuleOptions,
  fetchTaxRules,
  saveTaxRuleAction,
} from './actions';

export const metadata: Metadata = {
  title: 'Tax Rules',
};

export default async function TaxRulesPage() {
  const locale = await getLocale();
  const t = await getTranslations('tax.rules');
  const [rows, taxOptions] = await Promise.all([fetchTaxRules(), fetchTaxRuleOptions()]);

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} eyebrow={<>Tax</>} />

      <form
        action={saveTaxRuleAction}
        className="grid gap-3 rounded-xl border border-brand-cream-3 bg-card p-4 md:grid-cols-4"
      >
        <Select
          name="scopeKind"
          className="rounded border border-brand-cream-3 bg-card px-3 py-2 text-sm"
        >
          <option value="global_default">{t('scope.global_default')}</option>
          <option value="channel">{t('scope.channel')}</option>
          <option value="customer_segment">{t('scope.customer_segment')}</option>
          <option value="product_category">{t('scope.product_category')}</option>
        </Select>
        <input
          name="scopeId"
          placeholder={t('placeholders.scopeId')}
          className="rounded border border-brand-cream-3 bg-card px-3 py-2 text-sm"
        />
        <Select
          name="taxCode"
          className="rounded border border-brand-cream-3 bg-card px-3 py-2 text-sm"
        >
          {taxOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </Select>
        <input
          name="priority"
          type="number"
          defaultValue={10}
          className="rounded border border-brand-cream-3 bg-card px-3 py-2 text-sm"
        />
        <input
          name="effectiveFrom"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="rounded border border-brand-cream-3 bg-card px-3 py-2 text-sm"
        />
        <input
          name="effectiveUntil"
          type="date"
          className="rounded border border-brand-cream-3 bg-card px-3 py-2 text-sm"
        />
        <label className="inline-flex items-center gap-2 text-sm text-brand-ink-2">
          <input name="isAppliedDefault" type="checkbox" defaultChecked />
          {t('defaultApplied')}
        </label>
        <Button
          type="submit"
          className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red/90"
          variant="primary"
          size="md"
        >
          {t('saveRule')}
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <tr>
              <TableHead className="px-4 py-3">{t('columns.scope')}</TableHead>
              <TableHead className="px-4 py-3">{t('columns.tax')}</TableHead>
              <TableHead className="px-4 py-3">{t('columns.default')}</TableHead>
              <TableHead className="px-4 py-3 text-right">{t('columns.priority')}</TableHead>
              <TableHead className="px-4 py-3">{t('columns.effective')}</TableHead>
              <TableHead className="px-4 py-3">{t('columns.actions')}</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brand-ink-3">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              rows.map((rule) => (
                <tr key={rule.id}>
                  <TableCell className="px-4 py-3">
                    <p className="font-semibold text-brand-ink">{t(`scope.${rule.scopeKind}`)}</p>
                    <p className="text-xs text-brand-ink-3">{rule.scopeId ?? t('global')}</p>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-brand-ink">{rule.taxCode}</p>
                    <p className="text-xs text-brand-ink-3">{pickName(rule.taxName, locale)}</p>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {rule.isAppliedDefault ? t('yes') : t('no')}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">{rule.priority}</TableCell>
                  <TableCell className="px-4 py-3 text-brand-ink-3">
                    {formatDate(rule.effectiveFrom, locale, t('onwards'))} -{' '}
                    {formatDate(rule.effectiveUntil, locale, t('onwards'))}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-brand-red">
                        {t('edit')}
                      </summary>
                      <form action={saveTaxRuleAction} className="mt-3 grid min-w-80 gap-2">
                        <input type="hidden" name="id" value={rule.id} />
                        <Select
                          name="scopeKind"
                          defaultValue={rule.scopeKind}
                          className="rounded border border-brand-cream-3 bg-card px-2 py-1 text-xs"
                        >
                          <option value="global_default">{t('scope.global_default')}</option>
                          <option value="channel">{t('scope.channel')}</option>
                          <option value="customer_segment">{t('scope.customer_segment')}</option>
                          <option value="product_category">{t('scope.product_category')}</option>
                        </Select>
                        <input
                          name="scopeId"
                          defaultValue={rule.scopeId ?? ''}
                          className="rounded border border-brand-cream-3 bg-card px-2 py-1 text-xs"
                        />
                        <Select
                          name="taxCode"
                          defaultValue={rule.taxCode}
                          className="rounded border border-brand-cream-3 bg-card px-2 py-1 text-xs"
                        >
                          {taxOptions.map((option) => (
                            <option key={option.code} value={option.code}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                        <input
                          name="priority"
                          type="number"
                          defaultValue={rule.priority}
                          className="rounded border border-brand-cream-3 bg-card px-2 py-1 text-xs"
                        />
                        <input
                          name="effectiveFrom"
                          type="date"
                          defaultValue={rule.effectiveFrom}
                          className="rounded border border-brand-cream-3 bg-card px-2 py-1 text-xs"
                        />
                        <input
                          name="effectiveUntil"
                          type="date"
                          defaultValue={rule.effectiveUntil ?? ''}
                          className="rounded border border-brand-cream-3 bg-card px-2 py-1 text-xs"
                        />
                        <label className="inline-flex items-center gap-2 text-xs text-brand-ink-2">
                          <input
                            name="isAppliedDefault"
                            type="checkbox"
                            defaultChecked={rule.isAppliedDefault}
                          />
                          {t('columns.default')}
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
                      <form action={deleteTaxRuleAction} className="mt-2">
                        <input type="hidden" name="id" value={rule.id} />
                        <button type="submit" className="text-xs font-semibold text-brand-red">
                          {t('delete')}
                        </button>
                      </form>
                    </details>
                  </TableCell>
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function pickName(name: Record<string, string> | null, locale: string) {
  if (!name) return '-';
  return name[locale] ?? name.id ?? name.en ?? name.zh ?? '-';
}

function formatDate(value: string | null, locale: string, tOnwards: string) {
  if (!value) return tOnwards;
  const intlLocale = locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'id-ID';
  return new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(new Date(value));
}
