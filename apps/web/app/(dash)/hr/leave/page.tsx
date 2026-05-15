import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { deleteLeaveTypeAction, fetchLeaveDashboard, saveLeaveTypeAction } from './actions';

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

      <Panel title="Kelola Jenis Cuti">
        <form
          action={saveLeaveTypeAction}
          className="mb-4 grid gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-4 md:grid-cols-6"
        >
          <Field name="code" label="Kode" placeholder="annual" required />
          <Field name="nameId" label="Nama ID" placeholder="Cuti Tahunan" required />
          <Field name="nameEn" label="Nama EN" placeholder="Annual Leave" />
          <Field name="nameZh" label="Nama ZH" placeholder="年假" />
          <Field name="annualQuotaDays" label="Kuota/tahun" type="number" defaultValue="0" />
          <div className="flex flex-wrap items-end gap-3">
            <Check name="isPaid" label="Dibayar" defaultChecked />
            <Check name="requiresApproval" label="Approval" defaultChecked />
            <Check name="isActive" label="Aktif" defaultChecked />
            <button
              type="submit"
              className="rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark"
            >
              Tambah
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {data.types.length === 0 ? (
            <p className="text-sm text-brand-ink-3">Belum ada jenis cuti.</p>
          ) : (
            data.types.map((type) => (
              <form
                key={type.id}
                action={saveLeaveTypeAction}
                className="grid gap-3 rounded-lg border border-brand-cream-3 bg-card p-4 md:grid-cols-7"
              >
                <input type="hidden" name="id" value={type.id} />
                <Field name="code" label="Kode" defaultValue={type.code} required />
                <Field
                  name="nameId"
                  label="Nama ID"
                  defaultValue={type.name.id ?? pickName(type.name, locale)}
                  required
                />
                <Field name="nameEn" label="Nama EN" defaultValue={type.name.en ?? ''} />
                <Field name="nameZh" label="Nama ZH" defaultValue={type.name.zh ?? ''} />
                <Field
                  name="annualQuotaDays"
                  label="Kuota/tahun"
                  type="number"
                  defaultValue={String(type.annualQuotaDays)}
                />
                <div className="flex flex-wrap items-end gap-3">
                  <Check name="isPaid" label="Dibayar" defaultChecked={type.isPaid} />
                  <Check
                    name="requiresApproval"
                    label="Approval"
                    defaultChecked={type.requiresApproval}
                  />
                  <Check name="isActive" label="Aktif" defaultChecked={type.isActive} />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    className="rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark"
                  >
                    Simpan
                  </button>
                  <button
                    formAction={deleteLeaveTypeAction}
                    className="rounded-md border border-brand-cream-3 px-3 py-2 text-xs font-semibold text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red"
                  >
                    Hapus
                  </button>
                </div>
              </form>
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

function Field({
  name,
  label,
  type = 'text',
  defaultValue,
  placeholder,
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-brand-ink-3">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="h-9 w-full rounded-md border border-brand-cream-3 bg-card px-2.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
      />
    </label>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 pb-2 text-xs font-medium text-brand-ink-2">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
      />
      {label}
    </label>
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
