import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { fetchTaxRules } from './actions';

export const metadata: Metadata = {
  title: 'Tax Rules - Aroadri ERP',
};

export default async function TaxRulesPage() {
  const locale = await getLocale();
  const rows = await fetchTaxRules();

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

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
          <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
            <tr>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Tax</th>
              <th className="px-4 py-3">Default</th>
              <th className="px-4 py-3 text-right">Priority</th>
              <th className="px-4 py-3">Effective</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3 bg-card">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-brand-ink-3">
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
