'use client';

import { FilterBar, FilterField } from '@/components/filter-bar';
import { Pagination } from '@/components/pagination';
import type { SopRow } from '@erp/services/hr';
import { Button, Input, Select, Table, TableBody, TableCell, TableHead } from '@erp/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { deleteSopAction, updateSopAction } from './actions';
import { SopUploadForm } from './sop-upload-form';

interface Props {
  rows: SopRow[];
  total: number;
  page: number;
  pageSize: number;
  initialStatus: string;
  initialCategory: string;
  initialSearch: string;
  canManage: boolean;
  error: string | null;
}

const STATUSES = ['draft', 'published', 'archived'] as const;
const CATEGORIES = ['general', 'operations', 'hr', 'finance', 'safety', 'service'] as const;

function statusBadge(status: string): string {
  switch (status) {
    case 'published':
      return 'bg-brand-jade/10 text-brand-jade';
    case 'draft':
      return 'bg-brand-gold/10 text-brand-gold';
    case 'archived':
      return 'bg-brand-ink-3/10 text-brand-ink-3';
    default:
      return 'bg-brand-cream-3 text-brand-ink-2';
  }
}

function humanSize(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SopListClient(props: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const t = useTranslations('hr.sop');
  const [_isPending, startTransition] = useTransition();
  const [showUpload, setShowUpload] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(props.error ?? null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(props.total / props.pageSize)),
    [props.total, props.pageSize],
  );

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(search.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete('page');
    startTransition(() => router.push(`?${next.toString()}`));
  }

  async function togglePublish(row: SopRow) {
    setStatusBusy(row.id);
    const nextStatus = row.status === 'published' ? 'draft' : 'published';
    const result = await updateSopAction({ id: row.id, status: nextStatus });
    setStatusBusy(null);
    if (!result.ok) {
      setNotice(result.error ?? 'sop.updateFailed');
      return;
    }
    router.refresh();
  }

  async function performDelete() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setStatusBusy(id);
    const result = await deleteSopAction(id);
    setStatusBusy(null);
    if (!result.ok) {
      setNotice(result.error ?? 'sop.deleteFailed');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <div
          className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-rose-500 hover:text-rose-700"
            aria-label="dismiss"
          >
            ×
          </button>
        </div>
      ) : null}

      <FilterBar>
        <FilterField label={t('table.status')}>
          <Select
            value={props.initialStatus}
            onChange={(e) => updateParam('status', e.target.value)}
          >
            <option value="">{t('filter.all')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label={t('table.category')}>
          <Select
            value={props.initialCategory}
            onChange={(e) => updateParam('category', e.target.value)}
          >
            <option value="">{t('filter.all')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label={t('filter.searchLabel')} className="flex-1">
          <Input
            defaultValue={props.initialSearch}
            placeholder={t('filter.searchPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateParam('search', (e.target as HTMLInputElement).value);
            }}
          />
        </FilterField>
        {props.canManage ? (
          <Button variant="primary" size="md" onClick={() => setShowUpload(true)}>
            {t('filter.upload')}
          </Button>
        ) : null}
      </FilterBar>

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
        <Table>
          <thead className="bg-brand-cream-2/60">
            <tr>
              <TableHead className="px-4 py-3 text-left text-xs uppercase text-brand-ink-2">
                {t('table.title')}
              </TableHead>
              <TableHead className="px-4 py-3 text-left text-xs uppercase text-brand-ink-2">
                {t('table.category')}
              </TableHead>
              <TableHead className="px-4 py-3 text-left text-xs uppercase text-brand-ink-2">
                {t('table.status')}
              </TableHead>
              <TableHead className="px-4 py-3 text-left text-xs uppercase text-brand-ink-2">
                {t('table.size')}
              </TableHead>
              <TableHead className="px-4 py-3 text-right text-xs uppercase text-brand-ink-2">
                {t('table.action')}
              </TableHead>
            </tr>
          </thead>
          <TableBody>
            {props.rows.length === 0 ? (
              <tr>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-sm text-brand-ink-3">
                  {t('table.empty')}
                </TableCell>
              </tr>
            ) : (
              props.rows.map((row) => (
                <tr key={row.id} className="border-t border-brand-cream-3">
                  <TableCell className="px-4 py-3">
                    <div className="font-medium text-brand-ink">{row.title}</div>
                    {row.description ? (
                      <div className="line-clamp-2 text-xs text-brand-ink-3">{row.description}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-brand-ink-2">
                    {row.category}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-brand-ink-2">
                    {humanSize(row.fileSize)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/api/uploads/${row.fileKey}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-brand-cream-3 px-3 py-1 text-xs text-brand-ink hover:bg-brand-cream-2"
                      >
                        {t('action.download')}
                      </a>
                      {props.canManage ? (
                        <>
                          <button
                            type="button"
                            onClick={() => togglePublish(row)}
                            disabled={statusBusy === row.id}
                            className="rounded-lg border border-brand-cream-3 px-3 py-1 text-xs text-brand-ink hover:bg-brand-cream-2 disabled:opacity-50"
                          >
                            {row.status === 'published' ? t('action.draft') : t('action.publish')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(row.id)}
                            disabled={statusBusy === row.id}
                            className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            {t('action.delete')}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination currentPage={props.page} totalItems={props.total} pageSize={props.pageSize} />

      {showUpload ? (
        <SopUploadForm
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false);
            router.refresh();
          }}
        />
      ) : null}

      {confirmDeleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl border border-brand-cream-3 bg-card p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-brand-ink">{t('delete.title')}</h2>
            <p className="mt-2 text-sm text-brand-ink-3">
              {t('delete.desc')}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteId(null)}>
                {t('delete.cancel')}
              </Button>
              <Button variant="primary" size="sm" onClick={performDelete}>
                {t('delete.confirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
