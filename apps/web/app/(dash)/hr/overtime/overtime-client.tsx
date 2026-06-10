'use client';

import { ConfirmDialog, InlineAlert } from '@/components/confirm-dialog';
import { FilterBar, FilterField } from '@/components/filter-bar';
import { Pagination } from '@/components/pagination';
import {
  Button,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@erp/ui';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { approveOvertimeAction, recordOvertimeAction, rejectOvertimeAction } from './actions';

interface OvertimeRow {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  hours: string;
  reason: string;
  status: string;
  rejectReason: string | null;
  createdAt: string;
}

interface Props {
  data: { items: OvertimeRow[]; total: number };
  employees: Array<{ id: string; name: string }>;
  searchParams: Record<string, string | undefined>;
}

export function OvertimeClient({ data, employees, searchParams }: Props) {
  const t = useTranslations('hr.overtime');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [showForm, setShowForm] = useState(false);
  const [formEmployee, setFormEmployee] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formHours, setFormHours] = useState('');
  const [formReason, setFormReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveId, setApproveId] = useState<string | null>(null);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-brand-cream-3 text-brand-ink-2';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return t('statusPending');
      case 'approved':
        return t('statusApproved');
      case 'rejected':
        return t('statusRejected');
      default:
        return status;
    }
  };

  const handleSubmit = () => {
    if (!formEmployee || !formDate || !formHours || !formReason) return;
    setErrorMsg(null);
    startTransition(async () => {
      const res = await recordOvertimeAction(formEmployee, formDate, Number(formHours), formReason);
      if (res.error) {
        setErrorMsg(res.error);
        return;
      }
      setSuccessMsg(res.message ?? null);
      setShowForm(false);
      setFormEmployee('');
      setFormHours('');
      setFormReason('');
      router.refresh();
    });
  };

  const handleApprove = () => {
    if (!approveId) return;
    setErrorMsg(null);
    startTransition(async () => {
      const res = await approveOvertimeAction(approveId);
      if (res.error) setErrorMsg(res.error);
      else setSuccessMsg(res.message ?? null);
      setApproveId(null);
      router.refresh();
    });
  };

  const handleReject = () => {
    if (!rejectId || rejectReason.trim().length < 3) return;
    setErrorMsg(null);
    startTransition(async () => {
      const res = await rejectOvertimeAction(rejectId, rejectReason.trim());
      if (res.error) setErrorMsg(res.error);
      else setSuccessMsg(res.message ?? null);
      setRejectId(null);
      setRejectReason('');
      router.refresh();
    });
  };

  const page = Number.parseInt(searchParams.page || '1', 10);

  return (
    <div className="space-y-4">
      {errorMsg && (
        <InlineAlert message={errorMsg} tone="error" onDismiss={() => setErrorMsg(null)} />
      )}
      {successMsg && (
        <InlineAlert message={successMsg} tone="success" onDismiss={() => setSuccessMsg(null)} />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <FilterBar>
          <FilterField label={t('filterStatus')}>
            <Select
              className="w-full sm:w-40"
              value={searchParams.status || ''}
              onChange={(e) => updateFilter('status', e.target.value)}
            >
              <option value="">{t('allStatuses')}</option>
              <option value="pending">{t('statusPending')}</option>
              <option value="approved">{t('statusApproved')}</option>
              <option value="rejected">{t('statusRejected')}</option>
            </Select>
          </FilterField>
          <FilterField label={t('filterEmployee')}>
            <Select
              className="w-full sm:w-48"
              value={searchParams.employeeId || ''}
              onChange={(e) => updateFilter('employeeId', e.target.value)}
            >
              <option value="">{t('allEmployees')}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </FilterField>
        </FilterBar>
        <Button onClick={() => setShowForm(true)} disabled={isPending}>
          {t('newRecord')}
        </Button>
      </div>

      {showForm && (
        <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-brand-ink">{t('newRecord')}</h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                {t('employee')}
              </label>
              <Select
                value={formEmployee}
                onChange={(e) => setFormEmployee(e.target.value)}
                required
              >
                <option value="" disabled>
                  {tCommon('actions.select')}
                </option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                {t('workDate')}
              </label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                {t('hours')}
              </label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                max="12"
                placeholder="2"
                value={formHours}
                onChange={(e) => setFormHours(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                {t('reason')}
              </label>
              <Input
                placeholder={t('reasonPlaceholder')}
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !formEmployee || !formHours || !formReason}
            >
              {isPending ? tCommon('actions.saving') : t('submitRecord')}
            </Button>
          </div>
        </section>
      )}

      <section className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('employee')}</TableHead>
              <TableHead>{t('workDate')}</TableHead>
              <TableHead className="text-right">{t('hours')}</TableHead>
              <TableHead>{t('reason')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-brand-ink-3">
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((row) => (
                <TableRow key={row.id} className="hover:bg-brand-cream-2/50">
                  <TableCell className="font-medium text-brand-ink">{row.employeeName}</TableCell>
                  <TableCell className="text-brand-ink-2">{row.workDate}</TableCell>
                  <TableCell className="text-right font-semibold text-brand-ink">
                    {Number(row.hours)}h
                  </TableCell>
                  <TableCell className="max-w-[200px] text-brand-ink-2">
                    <span className="line-clamp-2">{row.reason}</span>
                    {row.rejectReason && (
                      <span className="mt-0.5 block text-xs text-rose-500">
                        {t('rejectedBecause')}: {row.rejectReason}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadge(row.status)}`}
                    >
                      {getStatusLabel(row.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.status === 'pending' && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setApproveId(row.id)}
                          disabled={isPending}
                          className="rounded-md border border-brand-jade/30 px-2.5 py-1 text-xs font-semibold text-brand-jade hover:bg-brand-jade/10"
                        >
                          {t('approve')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectId(row.id);
                            setRejectReason('');
                          }}
                          disabled={isPending}
                          className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          {t('reject')}
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {data.total > 0 && (
          <div className="border-t border-brand-cream-3 p-4">
            <Pagination currentPage={page} totalItems={data.total} pageSize={25} />
          </div>
        )}
      </section>

      {approveId && (
        <ConfirmDialog
          title={t('approveConfirmTitle')}
          message={t('approveConfirmMsg')}
          tone="default"
          onConfirm={handleApprove}
          onCancel={() => setApproveId(null)}
        />
      )}

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold text-brand-ink">{t('rejectTitle')}</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('rejectPlaceholder')}
              className="mt-3 h-24 w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRejectId(null)}>
                {tCommon('actions.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                disabled={isPending || rejectReason.trim().length < 3}
              >
                {isPending ? tCommon('actions.saving') : t('reject')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
