import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { fetchLeaveDashboard } from './actions';

export const metadata: Metadata = {
  title: 'Leave - Aroadri ERP',
};

export default async function LeavePage() {
  const locale = await getLocale();
  const data = await fetchLeaveDashboard();

  if (!data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Anda tidak memiliki akses HR.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">HR</p>
        <h1 className="mt-2 text-2xl font-bold text-brand-ink">Leave</h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-ink-3">
          Pantau jenis cuti, saldo cuti karyawan, dan pengajuan cuti terbaru.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric title="Jenis cuti" value={data.types.length} />
        <Metric title="Pengajuan terbaru" value={data.requests.length} />
        <Metric title="Saldo tercatat" value={data.balances.length} />
      </section>

      <Panel title="Jenis Cuti">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.types.length === 0 ? (
            <p className="text-sm text-brand-ink-3">Belum ada jenis cuti.</p>
          ) : (
            data.types.map((type) => (
              <div key={type.id} className="rounded-lg border border-brand-cream-3 bg-card p-4">
                <p className="font-semibold text-brand-ink">{pickName(type.name, locale)}</p>
                <p className="mt-1 text-xs text-brand-ink-3">
                  {type.code} - {type.annualQuotaDays} hari/tahun -{' '}
                  {type.isPaid ? 'paid' : 'unpaid'}
                </p>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel title="Pengajuan Cuti Terbaru">
        <Table
          headers={['Karyawan', 'Jenis', 'Tanggal', 'Hari', 'Status']}
          rows={data.requests.map((request) => [
            request.employeeName ?? '-',
            pickName(request.leaveTypeName, locale),
            `${formatDate(request.startDate, locale)} - ${formatDate(request.endDate, locale)}`,
            request.totalDays,
            request.status,
          ])}
        />
      </Panel>

      <Panel title="Saldo Cuti">
        <Table
          headers={['Karyawan', 'Jenis', 'Tahun', 'Total', 'Terpakai', 'Pending']}
          rows={data.balances.map((balance) => [
            balance.employeeName ?? '-',
            pickName(balance.leaveTypeName, locale),
            String(balance.year),
            balance.totalDays,
            balance.usedDays,
            balance.pendingDays,
          ])}
        />
      </Panel>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
      <p className="text-sm text-brand-ink-3">{title}</p>
      <p className="mt-2 text-2xl font-bold text-brand-ink">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-brand-cream-3">
      <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
        <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-cream-3 bg-card">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-6 text-center text-brand-ink-3">
                Belum ada data.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={`${row.join('|')}-${index}`}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${headers[cellIndex] ?? 'column'}-${cell}`}
                    className="px-4 py-3 text-brand-ink"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function pickName(name: Record<string, string> | null, locale: string) {
  if (!name) return '-';
  return name[locale] ?? name.id ?? name.en ?? name.zh ?? '-';
}

function formatDate(value: Date, locale: string) {
  const intlLocale = locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'id-ID';
  return new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(value);
}
