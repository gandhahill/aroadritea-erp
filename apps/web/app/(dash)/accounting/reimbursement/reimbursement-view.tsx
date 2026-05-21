'use client';

import { FileUploadField } from '@/components/file-upload-field';
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

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-brand-cream-2', text: 'text-brand-ink-2', label: 'Draf' },
  submitted: { bg: 'bg-brand-gold-light', text: 'text-brand-gold', label: 'Diajukan' },
  approved: { bg: 'bg-brand-jade-light', text: 'text-brand-jade', label: 'Disetujui' },
  disbursed: { bg: 'bg-brand-jade-light', text: 'text-brand-jade', label: 'Dicairkan' },
  rejected: { bg: 'bg-brand-clay-light', text: 'text-brand-clay', label: 'Ditolak' },
};

const CATEGORY_LABELS: Record<string, string> = {
  operational: 'Operasional',
  supplies: 'Perlengkapan',
  emergency: 'Darurat',
  other: 'Lainnya',
};

const CATEGORY_OPTIONS = [
  { value: 'operational', label: 'Operasional' },
  { value: 'supplies', label: 'Perlengkapan' },
  { value: 'emergency', label: 'Darurat' },
  { value: 'other', label: 'Lainnya' },
];

const STATUS_FILTERS = ['all', 'draft', 'submitted', 'approved', 'disbursed', 'rejected'] as const;

const STATUS_FILTER_LABELS: Record<string, string> = {
  all: 'Semua',
  draft: 'Draf',
  submitted: 'Diajukan',
  approved: 'Disetujui',
  disbursed: 'Dicairkan',
  rejected: 'Ditolak',
};

// --- Create Form Modal ---
interface CreateModalProps {
  locations: LocationItem[];
  tenantId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateModal({ locations, tenantId, userId, onClose, onSuccess }: CreateModalProps) {
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
      setError('Pilih lokasi.');
      return;
    }
    if (!amountNum || amountNum <= 0) {
      setError('Masukkan jumlah yang valid.');
      return;
    }
    if (!description.trim()) {
      setError('Masukkan keterangan.');
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
        setError(result.error ?? 'Terjadi kesalahan.');
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
          <h2 className="text-lg font-semibold text-brand-ink">Pengajuan Reimbursement</h2>
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
            <label className="block text-xs font-medium text-brand-ink-3">Lokasi</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="mt-1 w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            >
              <option value="">Pilih lokasi...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-ink-3">Jumlah (Rp)</label>
            <input
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0"
              className="mt-1 w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-ink-3">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-ink-3">Keterangan</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Jelaskan alasan pengajuan..."
              className="mt-1 w-full resize-none rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>

          <FileUploadField
            label="Lampiran"
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
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
            >
              {isPending ? 'Menyimpan...' : 'Simpan Draf'}
            </button>
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
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="surface-card w-full max-w-sm space-y-4 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-brand-ink">Tolak Pengajuan</h2>
        <div>
          <label className="block text-xs font-medium text-brand-ink-3">Alasan Penolakan</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Jelaskan alasan penolakan..."
            className="mt-1 w-full resize-none rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-brand-cream-3 px-4 py-2 text-sm text-brand-ink-2 hover:bg-brand-cream-2"
          >
            Batal
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || isPending}
            className="rounded-md bg-brand-clay px-4 py-2 text-sm font-medium text-white hover:bg-brand-clay/80 disabled:opacity-50"
          >
            {isPending ? 'Menolak...' : 'Tolak'}
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
        setActionError(result.error ?? 'Terjadi kesalahan.');
      }
    });
  };

  const handleSubmit = () => {
    if (!selectedId) return;
    handleAction(
      () => submitReimbursement(selectedId, tenantId, userId),
      'Pengajuan berhasil diajukan.',
    );
  };

  const handleApprove = () => {
    if (!selectedId) return;
    handleAction(
      () => approveReimbursement(selectedId, tenantId, userId),
      'Pengajuan berhasil disetujui.',
    );
  };

  const handleReject = (reason: string) => {
    if (!selectedId) return;
    handleAction(
      () => rejectReimbursement(selectedId, reason, tenantId, userId),
      'Pengajuan berhasil ditolak.',
    );
  };

  const handleDisburse = () => {
    if (!selectedId) return;
    handleAction(
      () => disburseReimbursement(selectedId, tenantId, userId),
      'Pengajuan berhasil dicairkan.',
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-card p-5">
          <span className="text-sm font-medium text-brand-ink-2">Menunggu Persetujuan</span>
          <p className="mt-2 text-2xl font-bold text-brand-gold">{summary.pending}</p>
        </div>
        <div className="surface-card p-5">
          <span className="text-sm font-medium text-brand-ink-2">Disetujui (Belum Cair)</span>
          <p className="mt-2 text-2xl font-bold text-brand-jade">{summary.approved}</p>
        </div>
        <div className="surface-card p-5">
          <span className="text-sm font-medium text-brand-ink-2">Total Pengajuan</span>
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
                {STATUS_FILTER_LABELS[s]}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-dark"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Pengajuan Baru
        </button>
      </div>

      {/* Table */}
      <div className="surface-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-cream-2 bg-brand-cream/50">
              <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Tanggal</th>
              <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Pemohon</th>
              <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Lokasi</th>
              <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Kategori</th>
              <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Keterangan</th>
              <th className="px-4 py-3 text-right font-medium text-brand-ink-2">Jumlah</th>
              <th className="px-4 py-3 text-center font-medium text-brand-ink-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-2">
            {visibleItems.map((r) => {
              const style = STATUS_STYLES[r.status] ?? {
                bg: 'bg-brand-cream-2',
                text: 'text-brand-ink-2',
                label: 'Draf',
              };
              return (
                <tr
                  key={r.id}
                  onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                  className={`cursor-pointer transition-colors ${
                    r.id === selectedId ? 'bg-brand-red/5' : 'hover:bg-brand-cream/50'
                  }`}
                >
                  <td className="px-4 py-3 text-brand-ink-2">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-brand-ink">{r.requesterName}</td>
                  <td className="px-4 py-3 text-brand-ink-2">{r.locationName}</td>
                  <td className="px-4 py-3 text-brand-ink-2">
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-brand-ink">
                    {r.description}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-brand-ink">
                    {formatRupiah(r.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
                    >
                      {style.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-brand-ink-3">
                  Belum ada pengajuan reimbursement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-brand-cream-3 bg-card px-4 py-3 text-xs text-brand-ink-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {filtered.length} pengajuan - Halaman {Math.min(page, totalPages)} dari {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-md border border-brand-cream-3 px-3 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-cream disabled:text-brand-ink-3 disabled:opacity-50"
          >
            Sebelumnya
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="rounded-md border border-brand-cream-3 px-3 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-cream disabled:text-brand-ink-3 disabled:opacity-50"
          >
            Berikutnya
          </button>
        </div>
      </div>

      {/* Detail panel + action buttons */}
      {selected && (
        <div className="surface-card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-brand-ink">Detail Pengajuan</h3>
            <button
              onClick={() => setSelectedId(null)}
              className="text-sm text-brand-ink-3 hover:text-brand-ink"
            >
              Tutup
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs font-medium text-brand-ink-3">Pemohon</span>
              <p className="mt-1 text-sm text-brand-ink">{selected.requesterName}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-brand-ink-3">Lokasi</span>
              <p className="mt-1 text-sm text-brand-ink">{selected.locationName}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-brand-ink-3">Kategori</span>
              <p className="mt-1 text-sm text-brand-ink">
                {CATEGORY_LABELS[selected.category] ?? selected.category}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-brand-ink-3">Jumlah</span>
              <p className="mt-1 text-sm font-medium text-brand-ink">
                {formatRupiah(selected.amount)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-xs font-medium text-brand-ink-3">Keterangan</span>
              <p className="mt-1 text-sm text-brand-ink">{selected.description}</p>
            </div>

            {selected.attachmentName && (
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-brand-ink-3">Lampiran</span>
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
              <span className="text-xs font-medium text-brand-ink-3">Status</span>
              <p className="mt-1">
                {(() => {
                  const style = STATUS_STYLES[selected.status] ?? {
                    bg: 'bg-brand-cream-2',
                    text: 'text-brand-ink-2',
                    label: 'Draf',
                  };
                  return (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
                    >
                      {style.label}
                    </span>
                  );
                })()}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-brand-ink-3">Tanggal Pengajuan</span>
              <p className="mt-1 text-sm text-brand-ink">{formatDate(selected.createdAt)}</p>
            </div>

            {selected.approverName && (
              <div>
                <span className="text-xs font-medium text-brand-ink-3">Disetujui oleh</span>
                <p className="mt-1 text-sm text-brand-ink">{selected.approverName}</p>
              </div>
            )}
            {selected.approvedAt && (
              <div>
                <span className="text-xs font-medium text-brand-ink-3">Tanggal Persetujuan</span>
                <p className="mt-1 text-sm text-brand-ink">{formatDate(selected.approvedAt)}</p>
              </div>
            )}
            {selected.disbursedAt && (
              <div>
                <span className="text-xs font-medium text-brand-ink-3">Tanggal Pencairan</span>
                <p className="mt-1 text-sm text-brand-ink">{formatDate(selected.disbursedAt)}</p>
              </div>
            )}
            {selected.rejectionReason && (
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-brand-ink-3">Alasan Penolakan</span>
                <p className="mt-1 text-sm text-brand-clay">{selected.rejectionReason}</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 border-t border-brand-cream-2 pt-4">
            {selected.status === 'draft' && (
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
              >
                {isPending ? 'Mengirim...' : 'Ajukan'}
              </button>
            )}
            {selected.status === 'submitted' && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={isPending}
                  className="rounded-md bg-brand-jade px-4 py-2 text-sm font-medium text-white hover:bg-brand-jade/80 disabled:opacity-50"
                >
                  {isPending ? 'Menyetujui...' : 'Setujui'}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isPending}
                  className="rounded-md border border-brand-clay px-4 py-2 text-sm font-medium text-brand-clay hover:bg-brand-clay-light disabled:opacity-50"
                >
                  Tolak
                </button>
              </>
            )}
            {selected.status === 'approved' && (
              <button
                onClick={handleDisburse}
                disabled={isPending}
                className="rounded-md bg-brand-gold px-4 py-2 text-sm font-medium text-white hover:bg-brand-gold/80 disabled:opacity-50"
              >
                {isPending ? 'Mencairkan...' : 'Cairkan'}
              </button>
            )}
            {(selected.status === 'disbursed' || selected.status === 'rejected') && (
              <p className="text-sm text-brand-ink-3">
                Pengajuan telah {selected.status === 'disbursed' ? 'dicairkan' : 'ditolak'}.
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
