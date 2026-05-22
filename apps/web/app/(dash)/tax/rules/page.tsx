import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import {
  deleteTaxRuleAction,
  fetchTaxRuleOptions,
  fetchTaxRules,
  saveTaxRuleAction,
} from './actions';

export const metadata: Metadata = {
  title: 'Tax Rules - Aroadri ERP',
};

export default async function TaxRulesPage() {
  const locale = await getLocale();
  const [rows, taxOptions] = await Promise.all([fetchTaxRules(), fetchTaxRuleOptions()]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">Tax</p>
        <h1 className="mt-2 text-2xl font-bold text-brand-ink">Tax Rules</h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-ink-3">
          Rule pajak menentukan PBJT/PPN berdasarkan channel, segmen pelanggan, kategori produk,
          atau default global.
        </p>
      </div>

      <form
        action={saveTaxRuleAction}
        className="grid gap-3 rounded-xl border border-brand-cream-3 bg-card p-4 md:grid-cols-4"
      >
        <select
          name="scopeKind"
          className="rounded border border-brand-cream-3 bg-card px-3 py-2 text-sm"
        >
          <option value="global_default">Global default</option>
          <option value="channel">Channel</option>
          <option value="customer_segment">Customer segment</option>
          <option value="product_category">Product category</option>
        </select>
        <input
          name="scopeId"
          placeholder="Scope ID, kosong untuk global"
          className="rounded border border-brand-cream-3 bg-card px-3 py-2 text-sm"
        />
        <select
          name="taxCode"
          className="rounded border border-brand-cream-3 bg-card px-3 py-2 text-sm"
        >
          {taxOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
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
          Default diterapkan
        </label>
        <button
          type="submit"
          className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red/90"
        >
          Simpan rule
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
          <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
            <tr>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Tax</th>
              <th className="px-4 py-3">Default</th>
              <th className="px-4 py-3 text-right">Priority</th>
              <th className="px-4 py-3">Effective</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3 bg-card">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brand-ink-3">
                  Belum ada tax rule.
                </td>
              </tr>
            ) : (
              rows.map((rule) => (
                <tr key={rule.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-brand-ink">{rule.scopeKind}</p>
                    <p className="text-xs text-brand-ink-3">{rule.scopeId ?? 'global'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-brand-ink">{rule.taxCode}</p>
                    <p className="text-xs text-brand-ink-3">{pickName(rule.taxName, locale)}</p>
                  </td>
                  <td className="px-4 py-3">{rule.isAppliedDefault ? 'Ya' : 'Tidak'}</td>
                  <td className="px-4 py-3 text-right">{rule.priority}</td>
                  <td className="px-4 py-3 text-brand-ink-3">
                    {formatDate(rule.effectiveFrom, locale)} -{' '}
                    {formatDate(rule.effectiveUntil, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-brand-red">
                        Edit
                      </summary>
                      <form action={saveTaxRuleAction} className="mt-3 grid min-w-80 gap-2">
                        <input type="hidden" name="id" value={rule.id} />
                        <select
                          name="scopeKind"
                          defaultValue={rule.scopeKind}
                          className="rounded border border-brand-cream-3 bg-card px-2 py-1 text-xs"
                        >
                          <option value="global_default">Global default</option>
                          <option value="channel">Channel</option>
                          <option value="customer_segment">Customer segment</option>
                          <option value="product_category">Product category</option>
                        </select>
                        <input
                          name="scopeId"
                          defaultValue={rule.scopeId ?? ''}
                          className="rounded border border-brand-cream-3 bg-card px-2 py-1 text-xs"
                        />
                        <select
                          name="taxCode"
                          defaultValue={rule.taxCode}
                          className="rounded border border-brand-cream-3 bg-card px-2 py-1 text-xs"
                        >
                          {taxOptions.map((option) => (
                            <option key={option.code} value={option.code}>
                              {option.label}
                            </option>
                          ))}
                        </select>
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
                          Default
                        </label>
                        <button
                          type="submit"
                          className="rounded bg-brand-red px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Simpan
                        </button>
                      </form>
                      <form action={deleteTaxRuleAction} className="mt-2">
                        <input type="hidden" name="id" value={rule.id} />
                        <button type="submit" className="text-xs font-semibold text-brand-red">
                          Hapus
                        </button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pickName(name: Record<string, string> | null, locale: string) {
  if (!name) return '-';
  return name[locale] ?? name.id ?? name.en ?? name.zh ?? '-';
}

function formatDate(value: string | null, locale: string) {
  if (!value) return 'seterusnya';
  const intlLocale = locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'id-ID';
  return new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(new Date(value));
}
