/**
 * Employee Detail Page — SD §9.6, §21.8
 *
 * Shows full employee record + tabs:
 * - Overview (personal info, employment details)
 * - Contracts (contract history with salary)
 * - Attendance (current year summary)
 * - Leave (balance + recent requests)
 */

import { getSession } from '@/lib/auth';
import { and, db, desc, eq, gte, lte } from '@erp/db';
import {
  attendance,
  employees,
  employmentContracts,
  leaveBalances,
  leaveRequests,
  leaveTypes,
} from '@erp/db/schema/hr';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Employee Detail' };

const STATUS_LABEL: Record<string, string> = {
  probation: 'Probation',
  active: 'Aktif',
  on_leave: 'Cuti',
  terminated: 'Diberhentikan',
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  probation: { bg: 'bg-brand-gold/10', text: 'text-brand-gold' },
  active: { bg: 'bg-brand-jade/10', text: 'text-brand-jade' },
  on_leave: { bg: 'bg-blue-50', text: 'text-blue-600' },
  terminated: { bg: 'bg-rose-50', text: 'text-rose-500' },
};

function formatMoney(v: string | number | bigint | null | undefined): string {
  if (!v) return '—';
  const num = typeof v === 'string' ? Number.parseInt(v, 10) : Number(v);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';

  // Fetch employee
  const [emp] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.tenantId, tenantId), eq(employees.id, id)))
    .limit(1);

  if (!emp) notFound();

  // Contracts
  const contracts = await db
    .select({
      id: employmentContracts.id,
      contractType: employmentContracts.contractType,
      startDate: employmentContracts.startDate,
      endDate: employmentContracts.endDate,
      isActive: employmentContracts.isActive,
      baseSalary: employmentContracts.baseSalary,
      notes: employmentContracts.notes,
    })
    .from(employmentContracts)
    .where(eq(employmentContracts.employeeId, id))
    .orderBy(desc(employmentContracts.startDate));

  // Attendance summary (current year)
  const year = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01T00:00:00Z`);
  const yearEnd = new Date(`${year}-12-31T23:59:59Z`);

  const attRows = await db
    .select({
      id: attendance.id,
      isLate: attendance.isLate,
    })
    .from(attendance)
    .where(
      and(
        eq(attendance.employeeId, id),
        eq(attendance.tenantId, tenantId),
        gte(attendance.checkInAt, yearStart),
        lte(attendance.checkInAt, yearEnd),
      ),
    );

  const attSummary = {
    totalDays: attRows.length,
    lateDays: attRows.filter((row) => row.isLate).length,
  };

  // Leave balances (current year)
  const balances = await db
    .select({
      leaveTypeId: leaveBalances.leaveTypeId,
      year: leaveBalances.year,
      totalDays: leaveBalances.totalDays,
      usedDays: leaveBalances.usedDays,
      pendingDays: leaveBalances.pendingDays,
      leaveTypeCode: leaveTypes.code,
      leaveTypeName: leaveTypes.name,
    })
    .from(leaveBalances)
    .leftJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
    .where(and(eq(leaveBalances.employeeId, id), eq(leaveBalances.year, year)));

  // Recent leave requests
  const recentRequests = await db
    .select({
      id: leaveRequests.id,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      totalDays: leaveRequests.totalDays,
      status: leaveRequests.status,
      reason: leaveRequests.reason,
      leaveTypeCode: leaveTypes.code,
      leaveTypeName: leaveTypes.name,
    })
    .from(leaveRequests)
    .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
    .where(eq(leaveRequests.employeeId, id))
    .orderBy(desc(leaveRequests.createdAt))
    .limit(6);

  const statusCfg = STATUS_COLOR[emp.status] ?? {
    bg: 'bg-brand-cream-2',
    text: 'text-brand-ink-2',
  };
  const statusLabel = STATUS_LABEL[emp.status] ?? emp.status;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <a
            href="/hr/employees"
            className="inline-flex items-center gap-1.5 text-sm text-brand-ink-3 transition-colors hover:text-brand-ember-5"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Employees
          </a>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Profile header */}
      <div className="flex items-center gap-4 rounded-xl border border-brand-cream-3 bg-card p-6">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-ember-5/10 text-xl font-semibold text-brand-ember-5">
          {emp.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-brand-ink">{emp.name}</h2>
          <p className="text-sm text-brand-ink-3">
            {emp.position}
            {emp.department ? ` — ${emp.department}` : ''}
          </p>
          <p className="text-xs text-brand-ink-3">
            NIK: {emp.nik} · {emp.email}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right text-sm">
          <span className="text-brand-ink-3">Hire Date</span>
          <span className="font-medium text-brand-ink">{formatDate(emp.hireDate)}</span>
          <span className="text-brand-ink-3">Contract</span>
          <span className="font-medium text-brand-ink">{emp.contractType.toUpperCase()}</span>
          <span className="text-brand-ink-3">Schedule</span>
          <span className="font-medium text-brand-ink capitalize">{emp.workSchedule}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        {/* Overview tab */}
        <div className="rounded-xl border border-brand-cream-3 bg-card p-6">
          <h3 className="mb-4 text-base font-semibold text-brand-ink">Personal Information</h3>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-brand-ink-3">Phone</dt>
              <dd className="font-medium text-brand-ink">{emp.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-brand-ink-3">NPWP</dt>
              <dd className="font-medium text-brand-ink">{emp.npwp ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-brand-ink-3">BPJS Kesehatan</dt>
              <dd className="font-medium text-brand-ink">{emp.bpjsKesehatan ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-brand-ink-3">BPJS TK</dt>
              <dd className="font-medium text-brand-ink">{emp.bpjsTenagakerja ?? '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-brand-ink-3">Address</dt>
              <dd className="font-medium text-brand-ink">{emp.address ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-brand-ink-3">Emergency Contact</dt>
              <dd className="font-medium text-brand-ink">
                {emp.emergencyContactName ?? '—'}
                {emp.emergencyContactPhone ? ` — ${emp.emergencyContactPhone}` : ''}
              </dd>
            </div>
          </dl>
        </div>

        {/* Contracts tab */}
        <div className="rounded-xl border border-brand-cream-3 bg-card p-6">
          <h3 className="mb-4 text-base font-semibold text-brand-ink">Contracts</h3>
          {contracts.length === 0 ? (
            <p className="text-sm text-brand-ink-3">No contracts on file.</p>
          ) : (
            <div className="space-y-3">
              {contracts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-brand-cream-2 bg-brand-cream-1 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-brand-ink">
                      {c.contractType === 'pkwt'
                        ? 'PKWT (Kontrak)'
                        : c.contractType === 'pkwtt'
                          ? 'PKWTT (Tetap)'
                          : c.contractType}
                      {c.isActive && <span className="ml-2 text-xs text-brand-jade">Active</span>}
                    </div>
                    <div className="text-xs text-brand-ink-3">
                      {formatDate(c.startDate)} — {c.endDate ? formatDate(c.endDate) : 'Permanent'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-brand-ember-5">
                      {formatMoney(c.baseSalary)}
                    </div>
                    <div className="text-xs text-brand-ink-3">per month</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance tab */}
        <div className="rounded-xl border border-brand-cream-3 bg-card p-6">
          <h3 className="mb-4 text-base font-semibold text-brand-ink">Attendance — {year}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-4 text-center">
              <div className="text-2xl font-bold text-brand-ink">{attSummary.totalDays}</div>
              <div className="text-xs text-brand-ink-3">Days Worked</div>
            </div>
            <div className="rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-4 text-center">
              <div className="text-2xl font-bold text-brand-gold">{attSummary.lateDays}</div>
              <div className="text-xs text-brand-ink-3">Late Days</div>
            </div>
            <div className="rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-4 text-center">
              <div className="text-2xl font-bold text-brand-ink">
                {emp.probationEndDate ? formatDate(emp.probationEndDate) : '—'}
              </div>
              <div className="text-xs text-brand-ink-3">Probation End</div>
            </div>
          </div>
        </div>

        {/* Leave tab */}
        <div className="rounded-xl border border-brand-cream-3 bg-card p-6">
          <h3 className="mb-4 text-base font-semibold text-brand-ink">Leave Balances — {year}</h3>
          {balances.length === 0 ? (
            <p className="text-sm text-brand-ink-3">No leave balance records.</p>
          ) : (
            <div className="mb-6 grid grid-cols-3 gap-3">
              {balances.map((b) => {
                const name = b.leaveTypeName as { id: string } | null;
                const total = Number.parseFloat(String(b.totalDays)) || 0;
                const used = Number.parseFloat(String(b.usedDays)) || 0;
                const pending = Number.parseFloat(String(b.pendingDays)) || 0;
                const remaining = Math.max(0, total - used - pending);
                return (
                  <div
                    key={b.leaveTypeId}
                    className="rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-4"
                  >
                    <div className="text-xs font-medium text-brand-ink-2">
                      {name?.id ?? b.leaveTypeCode ?? 'Unknown'}
                    </div>
                    <div className="mt-1 text-xl font-bold text-brand-ink">{remaining}</div>
                    <div className="text-xs text-brand-ink-3">of {total} days</div>
                  </div>
                );
              })}
            </div>
          )}
          {recentRequests.length > 0 && (
            <>
              <h4 className="mb-3 text-sm font-semibold text-brand-ink">Recent Requests</h4>
              <div className="space-y-2">
                {recentRequests.map((r) => {
                  const reqName = r.leaveTypeName as { id: string } | null;
                  const statusColor =
                    r.status === 'approved'
                      ? 'text-brand-jade'
                      : r.status === 'rejected'
                        ? 'text-rose-500'
                        : 'text-brand-gold';
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-brand-cream-2 px-4 py-2 text-sm"
                    >
                      <span className="text-brand-ink">{reqName?.id ?? r.leaveTypeCode}</span>
                      <span className="text-brand-ink-3">
                        {formatDate(r.startDate)} — {formatDate(r.endDate)}
                      </span>
                      <span className={`font-medium capitalize ${statusColor}`}>{r.status}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
