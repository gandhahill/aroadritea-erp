import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  createLeaveRequestAction,
  decideLeaveRequestAction,
  deleteLeaveRequestAction,
  deleteLeaveTypeAction,
  fetchLeaveDashboard,
  saveLeaveTypeAction,
} from './actions';

export const metadata: Metadata = {
  title: 'Leave - Aroadri ERP',
};

export default async function LeavePage() {
  const locale = await getLocale();
  const t = await getTranslations('hr.leave');
  const data = await fetchLeaveDashboard();

  if (!data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        {t('noAccess')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">HR</p>
        <h1 className="mt-2 text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-ink-3">
          {t('subtitle')}
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric title={t('typesCount')} value={data.types.length} />
        <Metric title={t('recentRequests')} value={data.requests.length} />
        <Metric title={t('balancesCount')} value={data.balances.length} />
      </section>

      <Panel title={t('manage')}>
        <form
          action={saveLeaveTypeAction}
          className="mb-4 grid gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-4 md:grid-cols-6"
        >
          <Field name="code" label={t('code')} placeholder="annual" required />
          <Field name="nameId" label={t('nameId')} placeholder="Cuti Tahunan" required />
          <Field name="nameEn" label={t('nameEn')} placeholder="Annual Leave" />
          <Field name="nameZh" label={t('nameZh')} placeholder="年假" />
          <Field name="annualQuotaDays" label={t('annualQuotaDays')} type="number" defaultValue="0" />
          <div className="flex flex-wrap items-end gap-3">
            <Check name="isPaid" label={t('isPaid')} defaultChecked />
            <Check name="requiresApproval" label={t('requiresApproval')} defaultChecked />
            <Check name="isActive" label={t('isActive')} defaultChecked />
            <button
              type="submit"
              className="rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark"
            >
              {t('addType')}
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {data.types.length === 0 ? (
            <p className="text-sm text-brand-ink-3">{t('emptyTypes')}</p>
          ) : (
            data.types.map((type) => (
              <form
                key={type.id}
                action={saveLeaveTypeAction}
                className="grid gap-3 rounded-lg border border-brand-cream-3 bg-card p-4 md:grid-cols-7"
              >
                <input type="hidden" name="id" value={type.id} />
                <Field name="code" label={t('code')} defaultValue={type.code} required />
                <Field
                  name="nameId"
                  label={t('nameId')}
                  defaultValue={type.name.id ?? pickName(type.name, locale)}
                  required
                />
                <Field name="nameEn" label={t('nameEn')} defaultValue={type.name.en ?? ''} />
                <Field name="nameZh" label={t('nameZh')} defaultValue={type.name.zh ?? ''} />
                <Field
                  name="annualQuotaDays"
                  label={t('annualQuotaDays')}
                  type="number"
                  defaultValue={String(type.annualQuotaDays)}
                />
                <div className="flex flex-wrap items-end gap-3">
                  <Check name="isPaid" label={t('isPaid')} defaultChecked={type.isPaid} />
                  <Check
                    name="requiresApproval"
                    label={t('requiresApproval')}
                    defaultChecked={type.requiresApproval}
                  />
                  <Check name="isActive" label={t('isActive')} defaultChecked={type.isActive} />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    className="rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark"
                  >
                    {t('saveType')}
                  </button>
                  <button
                    formAction={deleteLeaveTypeAction}
                    className="rounded-md border border-brand-cream-3 px-3 py-2 text-xs font-semibold text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red"
                  >
                    {t('deleteType')}
                  </button>
                </div>
              </form>
            ))
          )}
        </div>
      </Panel>

      <Panel title={t('requestHeader')}>
        <form
          action={createLeaveRequestAction}
          className="mb-4 grid gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-4 md:grid-cols-6"
        >
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-brand-ink-3">{t('employee')}</span>
            <select
              name="employeeId"
              required
              defaultValue=""
              className="h-9 w-full rounded-md border border-brand-cream-3 bg-card px-2.5 text-sm text-brand-ink"
            >
              <option value="" disabled>
                {t('chooseEmployee')}
              </option>
              {data.employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-brand-ink-3">{t('type')}</span>
            <select
              name="leaveTypeId"
              required
              defaultValue=""
              className="h-9 w-full rounded-md border border-brand-cream-3 bg-card px-2.5 text-sm text-brand-ink"
            >
              <option value="" disabled>
                {t('chooseType')}
              </option>
              {data.activeLeaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.nameId}
                </option>
              ))}
            </select>
          </label>
          <Field name="startDate" label={t('start')} type="date" required />
          <Field name="endDate" label={t('end')} type="date" required />
          <label className="space-y-1 md:col-span-6">
            <span className="text-xs font-medium text-brand-ink-3">{t('reasonOptional')}</span>
            <textarea
              name="reason"
              rows={2}
              className="w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink"
              placeholder={t('reasonPlaceholder')}
            />
          </label>
          <div className="md:col-span-6 flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
            >
              {t('submitRequest')}
            </button>
          </div>
        </form>

        <div className="overflow-x-auto rounded-lg border border-brand-cream-3">
          <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
            <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              <tr>
                <th className="px-4 py-3">{t('employee')}</th>
                <th className="px-4 py-3">{t('type')}</th>
                <th className="px-4 py-3">{t('date')}</th>
                <th className="px-4 py-3">{t('days')}</th>
                <th className="px-4 py-3">{t('status')}</th>
                <th className="px-4 py-3">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3 bg-card">
              {data.requestsFull.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-brand-ink-3">
                    {t('noRequestsTable')}
                  </td>
                </tr>
              ) : (
                data.requestsFull.map((req) => (
                  <tr key={req.id}>
                    <td className="px-4 py-3 text-brand-ink">{req.employeeName ?? '-'}</td>
                    <td className="px-4 py-3 text-brand-ink-2">
                      {pickName(req.leaveTypeName, locale)}
                    </td>
                    <td className="px-4 py-3 text-brand-ink-2">
                      {formatDate(req.startDate, locale)} – {formatDate(req.endDate, locale)}
                    </td>
                    <td className="px-4 py-3 text-brand-ink">{req.totalDays}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.status} t={t} />
                    </td>
                    <td className="px-4 py-3">
                      {data.canApprove && req.status === 'pending' ? (
                        <div className="flex flex-wrap gap-1">
                          <form action={decideLeaveRequestAction}>
                            <input type="hidden" name="id" value={req.id} />
                            <input type="hidden" name="decision" value="approved" />
                            <button
                              type="submit"
                              className="rounded-md bg-brand-jade px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
                            >
                              {t('approve')}
                            </button>
                          </form>
                          <form action={decideLeaveRequestAction}>
                            <input type="hidden" name="id" value={req.id} />
                            <input type="hidden" name="decision" value="rejected" />
                            <input
                              type="text"
                              name="rejectReason"
                              placeholder={t('rejectReason')}
                              className="h-7 w-32 rounded-md border border-brand-cream-3 bg-card px-2 text-[11px]"
                            />
                            <button
                              type="submit"
                              className="ml-1 rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                            >
                              {t('reject')}
                            </button>
                          </form>
                        </div>
                      ) : null}
                      {data.canApprove ? (
                        <form action={deleteLeaveRequestAction} className="mt-1">
                          <input type="hidden" name="id" value={req.id} />
                          <button
                            type="submit"
                            className="text-xs text-brand-ink-3 hover:text-brand-red"
                          >
                            {t('deleteType')}
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={t('balance')}>
        <Table
          headers={[t('employee'), t('type'), t('year'), t('total'), t('used'), t('pending')]}
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

function StatusBadge({ status, t }: { status: string; t: any }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: t('statusPending'), cls: 'bg-brand-gold/10 text-brand-gold' },
    approved: { label: t('statusApproved'), cls: 'bg-brand-jade/10 text-brand-jade' },
    rejected: { label: t('statusRejected'), cls: 'bg-rose-50 text-rose-600' },
    cancelled: { label: t('statusCancelled'), cls: 'bg-brand-cream-2 text-brand-ink-3' },
  };
  const e = map[status] ?? { label: status, cls: 'bg-brand-cream-2 text-brand-ink-3' };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.cls}`}>
      {e.label}
    </span>
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
