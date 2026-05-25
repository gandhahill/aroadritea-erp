'use client';

import { FileUploadField } from '@/components/file-upload-field';
import { Button, Input, Select, TableCell, TableHead } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import type { LocationItem, ReimbursementItem } from './actions';
import {
  approveReimbursement,
  createReimbursement,
  disburseReimbursement,
  fetchReimbursements,
  rejectReimbursement,
  submitReimbursement,
} from './actions';

function formatRupiah(amount: string): string {
  const n = Number(amount);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-brand-cream-2', text: 'text-brand-ink-2' },
  submitted: { bg: 'bg-brand-gold-light', text: 'text-brand-gold' },
  approved: { bg: 'bg-brand-jade-light', text: 'text-brand-jade' },
  disbursed: { bg: 'bg-brand-jade-light', text: 'text-brand-jade' },
  rejected: { bg: 'bg-brand-clay-light', text: 'text-brand-clay' },
};

const CATEGORY_OPTIONS = ['operational', 'supplies', 'emergency', 'other'] as const;

const STATUS_FILTERS = ['all', 'draft', 'submitted', 'approved', 'disbursed', 'rejected'] as const;

// --- Create Form Modal ---
interface CreateModalProps {
  locations: LocationItem[];
  tenantId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateModal({ locations, tenantId, userId, onClose, onSuccess }: CreateModalProps) {
  const t = useTranslations('accounting.reimbursement');
  const [isPending, startTransition] = useTransition();
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('operational');
  const [description, setDescription] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountNum = Number.parseFloat(amount.replace(/[^\d]/g, ''));
    if (!locationId) {
      setError(t('errors.noLocation'));
      return;
    }
    if (!amountNum || amountNum <= 0) {
      setError(t('errors.invalidAmount'));
      return;
    }
    if (!description.trim()) {
      setError(t('errors.noDescription'));
      return;
    }

    startTransition(async () => {
      const result = await createReimbursement(
        {
          locationId,
          amount: amountNum,
          category,
          description: description.trim(),
          attachmentUrl: attachmentUrl || undefined,
          attachmentName: attachmentName || undefined,
        },
        tenantId,
        userId,
      );
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error ?? t('errors.failed'));
      }
    });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    setAmount(raw ? Number.parseInt(raw).toLocaleString('id-ID') : '');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="surface-card w-full max-w-md space-y-5 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-ink">{t('createTitle')}</h2>
          <button onClick={onClose} className="text-brand-ink-3 hover:text-brand-ink">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-brand-ink-3">{t('location')}</label>
            <Select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="mt-1 w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            >
              <option value="">{t('selectLocation')}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-ink-3">{t('amount')} (Rp)</label>
            <Input
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0"
              className="mt-1 w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-ink-3">{t('category')}</label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {t(`categories.${opt}`)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-ink-3">{t('description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t('descPlaceholder')}
              className="mt-1 w-full resize-none rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>

          <FileUploadField
            label={t('attachment')}
            hiddenName="attachmentUrl"
            value={attachmentUrl}
            area="reimbursement"
            visibility="private"
            onChange={(url, name) => {
              setAttachmentUrl(url);
              setAttachmentName(name);
            }}
          />

          {error && (
            <p className="rounded-md bg-brand-clay-light px-3 py-2 text-xs text-brand-clay">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-brand-cream-3 px-4 py-2 text-sm text-brand-ink-2 hover:bg-brand-cream-2"
            >
              {t('cancel')}
            </button>
            <Button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
              variant="primary"
              size="md"
            >
              {isPending ? t('saving') : t('saveDraft')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Reject Modal ---
interface RejectModalProps {
  onConfirm: (reason: string) => void;
  onClose: () => void;
  isPending: boolean;
}

function RejectModal({ onConfirm, onClose, isPending }: RejectModalProps) {
  const t = useTranslations('accounting.reimbursement');
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="surface-card w-full max-w-sm space-y-4 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-brand-ink">{t('rejectTitle')}</h2>
        <div>
          <label className="block text-xs font-medium text-brand-ink-3">
            {t('modalRejectReason')}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={t('modalRejectPlaceholder')}
            className="mt-1 w-full resize-none rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-brand-cream-3 px-4 py-2 text-sm text-brand-ink-2 hover:bg-brand-cream-2"
          >
            {t('cancel')}
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || isPending}
            className="rounded-md bg-brand-clay px-4 py-2 text-sm font-medium text-white hover:bg-brand-clay/80 disabled:opacity-50"
          >
            {isPending ? t('modalRejecting') : t('modalReject')}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main View ---
interface ReimbursementProps {
  initialItems: ReimbursementItem[];
  locations: LocationItem[];
  tenantId: string;
  userId: string;
}

export function ReimbursementClient({
  initialItems,
  locations,
  tenantId,
  userId,
}: ReimbursementProps) {
  const [items, setItems] = useState<ReimbursementItem[]>(initialItems);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await fetchReimbursements(tenantId);
      setItems(fresh);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <ReimbursementViewInner
      items={items}
      locations={locations}
      tenantId={tenantId}
      userId={userId}
      onRefresh={refresh}
      isRefreshing={isRefreshing}
    />
  );
}

interface ReimbursementViewInnerProps {
  items: ReimbursementItem[];
  locations: LocationItem[];
  tenantId: string;
  userId: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function ReimbursementViewInner({
  items,
  locations,
  tenantId,
  userId,
  onRefresh,
  isRefreshing,
}: ReimbursementViewInnerProps) {
  const t = useTranslations('accounting.reimbursement');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!filterStatus) return items;
    return items.filter((r) => r.status === filterStatus);
  }, [items, filterStatus]);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleItems = filtered.slice(
    (Math.min(page, totalPages) - 1) * pageSize,
    Math.min(page, totalPages) * pageSize,
  );

  const selected = useMemo(
    () => items.find((r) => r.id === selectedId) ?? null,
    [items, selectedId],
  );

  const summary = useMemo(() => {
    const pending = items.filter((r) => r.status === 'submitted').length;
    const approved = items.filter((r) => r.status === 'approved').length;
    const totalAmount = items
      .filter((r) => r.status !== 'rejected')
      .reduce((acc, r) => acc + Number(r.amount), 0);
    return { pending, approved, totalAmount };
  }, [items]);

  const handleAction = (
    action: () => Promise<{ success: boolean; error?: string }>,
    successMsg: string,
  ) => {
    setActionError('');
    setActionSuccess('');
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        setActionSuccess(successMsg);
        setShowRejectModal(false);
        onRefresh();
        setTimeout(() => setActionSuccess(''), 3000);
      } else {
        setActionError(result.error ?? t('errors.failed'));
      }
    });
  };

  const handleSubmit = () => {
    if (!selectedId) return;
    handleAction(() => submitReimbursement(selectedId, tenantId, userId), t('submitSuccess'));
  };

  const handleApprove = () => {
    if (!selectedId) return;
    handleAction(() => approveReimbursement(selectedId, tenantId, userId), t('approveSuccess'));
  };

  const handleReject = (reason: string) => {
    if (!selectedId) return;
    handleAction(
      () => rejectReimbursement(selectedId, reason, tenantId, userId),
      t('rejectSuccess'),
    );
  };

  const handleDisburse = () => {
    if (!selectedId) return;
    handleAction(() => disburseReimbursement(selectedId, tenantId, userId), t('disburseSuccess'));
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-card p-5">
          <span className="text-sm font-medium text-brand-ink-2">{t('pendingApproval')}</span>
          <p className="mt-2 text-2xl font-bold text-brand-gold">{summary.pending}</p>
        </div>
        <div className="surface-card p-5">
          <span className="text-sm font-medium text-brand-ink-2">{t('approvedNotPaid')}</span>
          <p className="mt-2 text-2xl font-bold text-brand-jade">{summary.approved}</p>
        </div>
        <div className="surface-card p-5">
          <span className="text-sm font-medium text-brand-ink-2">{t('totalRequests')}</span>
          <p className="mt-2 text-2xl font-bold text-brand-ink">
            {formatRupiah(summary.totalAmount.toString())}
          </p>
        </div>
      </div>

      {/* Feedback banners */}
      {actionError && (
        <div className="rounded-md bg-brand-clay-light px-4 py-3 text-sm text-brand-clay">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-md bg-brand-jade-light px-4 py-3 text-sm text-brand-jade">
          {actionSuccess}
        </div>
      )}

      {/* Filter + Create button */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => {
            const isActive = s === 'all' ? !filterStatus : filterStatus === s;
            return (
              <button
                key={s}
                onClick={() => {
                  setFilterStatus(s === 'all' ? null : s);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-red text-white'
                    : 'bg-brand-cream-2 text-brand-ink-2 hover:bg-brand-cream-3'
                }`}
              >
                {t(`status.${s}`)}
              </button>
            );
          })}
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-dark"
          variant="primary"
          size="md"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('newRequest')}
        </Button>
      </div>

      {/* Table */}
      <div className="surface-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-cream-2 bg-brand-cream/50">
              <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
                {t('date')}
              </TableHead>
              <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
                {t('requester')}
              </TableHead>
              <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
                {t('location')}
              </TableHead>
              <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
                {t('category')}
              </TableHead>
              <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
                {t('description')}
              </TableHead>
              <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                {t('amount')}
              </TableHead>
              <TableHead className="px-4 py-3 text-center font-medium text-brand-ink-2">
                {t('statusLabel')}
              </TableHead>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-2">
            {visibleItems.map((r) => {
              const style = STATUS_STYLES[r.status] ?? {
                bg: 'bg-brand-cream-2',
                text: 'text-brand-ink-2',
              };
              return (
                <tr
                  key={r.id}
                  onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                  className={`cursor-pointer transition-colors ${
                    r.id === selectedId ? 'bg-brand-red/5' : 'hover:bg-brand-cream/50'
                  }`}
                >
                  <TableCell className="px-4 py-3 text-brand-ink-2">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-brand-ink">{r.requesterName}</TableCell>
                  <TableCell className="px-4 py-3 text-brand-ink-2">{r.locationName}</TableCell>
                  <TableCell className="px-4 py-3 text-brand-ink-2">
                    {t(`categories.${r.category}`)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate px-4 py-3 text-brand-ink">
                    {r.description}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-medium text-brand-ink">
                    {formatRupiah(r.amount)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
                    >
                      {t(`status.${r.status}`)}
                    </span>
                  </TableCell>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-brand-ink-3">
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-brand-cream-3 bg-card px-4 py-3 text-xs text-brand-ink-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {t('pagination', {
            count: filtered.length,
            current: Math.min(page, totalPages),
            total: totalPages,
          })}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-md border border-brand-cream-3 px-3 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-cream disabled:text-brand-ink-3 disabled:opacity-50"
          >
            {t('prev')}
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="rounded-md border border-brand-cream-3 px-3 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-cream disabled:text-brand-ink-3 disabled:opacity-50"
          >
            {t('next')}
          </button>
        </div>
      </div>

      {/* Detail panel + action buttons */}
      {selected && (
        <div className="surface-card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-brand-ink">{t('details')}</h3>
            <button
              onClick={() => setSelectedId(null)}
              className="text-sm text-brand-ink-3 hover:text-brand-ink"
            >
              {t('close')}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs font-medium text-brand-ink-3">{t('requester')}</span>
              <p className="mt-1 text-sm text-brand-ink">{selected.requesterName}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-brand-ink-3">{t('location')}</span>
              <p className="mt-1 text-sm text-brand-ink">{selected.locationName}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-brand-ink-3">{t('category')}</span>
              <p className="mt-1 text-sm text-brand-ink">{t(`categories.${selected.category}`)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-brand-ink-3">{t('amount')}</span>
              <p className="mt-1 text-sm font-medium text-brand-ink">
                {formatRupiah(selected.amount)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-xs font-medium text-brand-ink-3">{t('description')}</span>
              <p className="mt-1 text-sm text-brand-ink">{selected.description}</p>
            </div>

            {selected.attachmentName && (
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-brand-ink-3">{t('attachment')}</span>
                {selected.attachmentUrl ? (
                  <a
                    href={selected.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-sm font-semibold text-brand-red"
                  >
                    {selected.attachmentName}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-brand-ink">{selected.attachmentName}</p>
                )}
              </div>
            )}

            <div>
              <span className="text-xs font-medium text-brand-ink-3">{t('statusLabel')}</span>
              <p className="mt-1">
                {(() => {
                  const style = STATUS_STYLES[selected.status] ?? {
                    bg: 'bg-brand-cream-2',
                    text: 'text-brand-ink-2',
                  };
                  return (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
                    >
                      {t(`status.${selected.status}`)}
                    </span>
                  );
                })()}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-brand-ink-3">{t('dateSubmitted')}</span>
              <p className="mt-1 text-sm text-brand-ink">{formatDate(selected.createdAt)}</p>
            </div>

            {selected.approverName && (
              <div>
                <span className="text-xs font-medium text-brand-ink-3">{t('approvedBy')}</span>
                <p className="mt-1 text-sm text-brand-ink">{selected.approverName}</p>
              </div>
            )}
            {selected.approvedAt && (
              <div>
                <span className="text-xs font-medium text-brand-ink-3">{t('dateApproved')}</span>
                <p className="mt-1 text-sm text-brand-ink">{formatDate(selected.approvedAt)}</p>
              </div>
            )}
            {selected.disbursedAt && (
              <div>
                <span className="text-xs font-medium text-brand-ink-3">{t('dateDisbursed')}</span>
                <p className="mt-1 text-sm text-brand-ink">{formatDate(selected.disbursedAt)}</p>
              </div>
            )}
            {selected.rejectionReason && (
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-brand-ink-3">{t('rejectReason')}</span>
                <p className="mt-1 text-sm text-brand-clay">{selected.rejectionReason}</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 border-t border-brand-cream-2 pt-4">
            {selected.status === 'draft' && (
              <Button
                onClick={handleSubmit}
                disabled={isPending}
                className="rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
                variant="primary"
                size="md"
              >
                {isPending ? t('submitting') : t('submitRequest')}
              </Button>
            )}
            {selected.status === 'submitted' && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={isPending}
                  className="rounded-md bg-brand-jade px-4 py-2 text-sm font-medium text-white hover:bg-brand-jade/80 disabled:opacity-50"
                >
                  {isPending ? t('approving') : t('approveRequest')}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isPending}
                  className="rounded-md border border-brand-clay px-4 py-2 text-sm font-medium text-brand-clay hover:bg-brand-clay-light disabled:opacity-50"
                >
                  {t('modalReject')}
                </button>
              </>
            )}
            {selected.status === 'approved' && (
              <button
                onClick={handleDisburse}
                disabled={isPending}
                className="rounded-md bg-brand-gold px-4 py-2 text-sm font-medium text-white hover:bg-brand-gold/80 disabled:opacity-50"
              >
                {isPending ? t('disbursing') : t('disburse')}
              </button>
            )}
            {(selected.status === 'disbursed' || selected.status === 'rejected') && (
              <p className="text-sm text-brand-ink-3">
                {selected.status === 'disbursed' ? t('alreadyDisbursed') : t('alreadyRejected')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateModal
          locations={locations}
          tenantId={tenantId}
          userId={userId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            onRefresh();
          }}
        />
      )}
      {showRejectModal && (
        <RejectModal
          onConfirm={handleReject}
          onClose={() => setShowRejectModal(false)}
          isPending={isPending}
        />
      )}
    </div>
  );
}
