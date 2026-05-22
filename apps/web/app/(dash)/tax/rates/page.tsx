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

const COPY = {
  id: {
    title: 'Tarif Pajak',
    subtitle:
      'Tarif PB1/PBJT, PPN, dan pajak lain tersimpan di database agar tidak hardcoded di kode.',
    code: 'Kode',
    name: 'Nama',
    rate: 'Tarif',
    calculation: 'Perhitungan',
    account: 'Akun posting',
    effective: 'Berlaku',
    status: 'Status',
    active: 'Aktif',
    inactive: 'Nonaktif',
    inclusive: 'Inclusive',
    exclusive: 'Exclusive',
    empty: 'Belum ada tarif pajak.',
  },
  en: {
    title: 'Tax Rates',
    subtitle:
      'PB1/PBJT, VAT, and other tax rates live in the database so code never hardcodes tax values.',
    code: 'Code',
    name: 'Name',
    rate: 'Rate',
    calculation: 'Calculation',
    account: 'Posting account',
    effective: 'Effective',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    inclusive: 'Inclusive',
    exclusive: 'Exclusive',
    empty: 'No tax rates yet.',
  },
  zh: {
    title: '税率',
    subtitle: 'PB1/PBJT、增值税和其他税率保存在数据库中，代码不写死税率。',
    code: '代码',
    name: '名称',
    rate: '税率',
    calculation: '计算',
    account: '入账科目',
    effective: '生效',
    status: '状态',
    active: '启用',
    inactive: '停用',
    inclusive: '价内',
    exclusive: '价外',
    empty: '暂无税率。',
  },
} as const;

function getCopy(locale: string) {
  return COPY[locale as keyof typeof COPY] ?? COPY.id;
}

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
  const copy = getCopy(locale);
  const [rows, accountOptions] = await Promise.all([fetchTaxRates(), fetchTaxAccountOptions()]);

  return (
    <main className="min-h-screen bg-brand-paper text-brand-ink">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">Tax</p>
          <h1 className="font-display text-3xl font-semibold text-brand-ink">{copy.title}</h1>
          <p className="max-w-3xl text-sm leading-6 text-brand-muted">{copy.subtitle}</p>
        </div>

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
          <select
            name="calculation"
            className="rounded border border-brand-ink/10 bg-card px-3 py-2 text-sm"
          >
            <option value="inclusive">{copy.inclusive}</option>
            <option value="exclusive">{copy.exclusive}</option>
          </select>
          <select
            name="postingAccountId"
            className="rounded border border-brand-ink/10 bg-card px-3 py-2 text-sm"
          >
            <option value="">Pilih akun posting</option>
            {accountOptions.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
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
            {copy.active}
          </label>
          <button
            type="submit"
            className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red/90"
          >
            Simpan tarif
          </button>
        </form>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-brand-ink/10 bg-brand-porcelain p-6 text-sm text-brand-muted">
            {copy.empty}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-brand-ink/10 bg-brand-porcelain">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-brand-ink/10 bg-brand-paper/70 text-xs uppercase tracking-[0.14em] text-brand-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{copy.code}</th>
                    <th className="px-4 py-3 font-semibold">{copy.name}</th>
                    <th className="px-4 py-3 font-semibold">{copy.rate}</th>
                    <th className="px-4 py-3 font-semibold">{copy.calculation}</th>
                    <th className="px-4 py-3 font-semibold">{copy.account}</th>
                    <th className="px-4 py-3 font-semibold">{copy.effective}</th>
                    <th className="px-4 py-3 font-semibold">{copy.status}</th>
                    <th className="px-4 py-3 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-ink/10">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-brand-paper/70">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-red">
                        {row.code}
                      </td>
                      <td className="px-4 py-3 font-semibold text-brand-ink">
                        {pickName(row.name, locale)}
                      </td>
                      <td className="px-4 py-3 text-brand-muted">{row.ratePercent}%</td>
                      <td className="px-4 py-3 text-brand-muted">
                        {row.calculation === 'inclusive' ? copy.inclusive : copy.exclusive}
                      </td>
                      <td className="px-4 py-3 text-brand-muted">{row.postingAccount}</td>
                      <td className="px-4 py-3 text-brand-muted">
                        {formatDate(row.effectiveFrom, locale)} -{' '}
                        {formatDate(row.effectiveUntil, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            row.isActive
                              ? 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade'
                              : 'border-brand-ink/15 bg-brand-ink/5 text-brand-muted'
                          }`}
                        >
                          {row.isActive ? copy.active : copy.inactive}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <details className="group">
                          <summary className="cursor-pointer text-xs font-semibold text-brand-red">
                            Edit
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
                            <select
                              name="calculation"
                              defaultValue={row.calculation}
                              className="rounded border border-brand-ink/10 bg-card px-2 py-1 text-xs"
                            >
                              <option value="inclusive">{copy.inclusive}</option>
                              <option value="exclusive">{copy.exclusive}</option>
                            </select>
                            <select
                              name="postingAccountId"
                              defaultValue={row.postingAccountId}
                              className="rounded border border-brand-ink/10 bg-card px-2 py-1 text-xs"
                            >
                              {accountOptions.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.label}
                                </option>
                              ))}
                            </select>
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
                              {copy.active}
                            </label>
                            <button
                              type="submit"
                              className="rounded bg-brand-red px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Simpan
                            </button>
                          </form>
                          <form action={deleteTaxRateAction} className="mt-2">
                            <input type="hidden" name="id" value={row.id} />
                            <button type="submit" className="text-xs font-semibold text-brand-red">
                              Nonaktifkan
                            </button>
                          </form>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
