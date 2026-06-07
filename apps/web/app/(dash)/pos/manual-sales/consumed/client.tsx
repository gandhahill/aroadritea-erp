'use client';

import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import {
  Button,
  Input,
  SearchableSelect,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  toast,
} from '@erp/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import {
  createConsumedIngredientsAction,
  deleteConsumedIngredientsAction,
  fetchConsumedIngredientDetailAction,
} from './actions';

function ExpandableItemList({
  items,
  formatQty,
  moreLabel,
  collapseLabel,
}: {
  items: Array<{ name: string; qty: string; uom: string }>;
  formatQty: (qty: string) => string;
  moreLabel: (count: number) => string;
  collapseLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? items : items.slice(0, 3);
  const hasMore = items.length > 3;

  return (
    <div className="mt-1 max-w-[300px] space-y-0.5 text-xs text-brand-ink-3">
      {display.map((line, index) => (
        <div key={`${line.name}-${line.uom}-${index}`}>
          {line.name} · {formatQty(line.qty)} {line.uom}
        </div>
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-0.5 text-xs font-medium text-brand-red hover:underline"
        >
          {expanded ? collapseLabel : moreLabel(items.length - 3)}
        </button>
      )}
    </div>
  );
}

interface ConsumedHistoryItem {
  id: string;
  occurredAt: string;
  locationId: string;
  locationLabel: string;
  itemCount: number;
  items: Array<{ name: string; qty: string; uom: string }>;
  notes: string | null;
  createdByName: string | null;
  updatedByName: string | null;
}

interface Props {
  data: {
    locations: Array<{ id: string; label: string; code: string }>;
    ingredients: Array<{ id: string; name: string; uom: string }>;
    history: {
      items: ConsumedHistoryItem[];
      total: number;
      page: number;
      pageSize: number;
    };
  };
  defaultLocationId: string;
}

function formatHistoryQty(value: string): string {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return value;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(numberValue);
}

/** Render a UTC ISO timestamp as a WIB (Asia/Jakarta) calendar date YYYY-MM-DD. */
function toWibDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

export function ConsumedClient({ data, defaultLocationId }: Props) {
  const t = useTranslations('pos.manualSales');
  const router = useRouter();
  const [state, submitAction, isPending] = useActionState(createConsumedIngredientsAction, null);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [editLocationId, setEditLocationId] = useState(defaultLocationId);
  const [entryDate, setEntryDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }));
  const [entryNotes, setEntryNotes] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyLocationFilter, setHistoryLocationFilter] = useState('');
  const [consumedIngredients, setConsumedIngredients] = useState<
    Array<{ ingredientId: string; name: string; qty: number | ''; uom: string }>
  >([]);

  useEffect(() => {
    if (state?.ok) {
      const form = document.getElementById('consumed-ingredients-form') as HTMLFormElement | null;
      form?.reset();
      setConsumedIngredients([]);
      setReferenceId(null);
      setEditLocationId(defaultLocationId);
      setEntryDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }));
      setEntryNotes('');
      router.refresh();
    }
  }, [state, defaultLocationId, router]);

  const startEdit = async (id: string) => {
    setLoadingDetailId(id);
    const res = await fetchConsumedIngredientDetailAction(id);
    setLoadingDetailId(null);

    if (!res.ok || !res.value) {
      toast.error(res.error || t('failedToLoad'));
      return;
    }

    setReferenceId(res.value.referenceId);
    setEditLocationId(res.value.locationId);
    setEntryDate(res.value.date);
    setEntryNotes(res.value.notes ?? '');
    setConsumedIngredients(res.value.consumedIngredients);
    setTimeout(() => {
      document.getElementById('consumed-ingredients-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const resetEdit = () => {
    setReferenceId(null);
    setEditLocationId(defaultLocationId);
    setEntryDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }));
    setEntryNotes('');
    setConsumedIngredients([]);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    const res = await deleteConsumedIngredientsAction(deleteConfirmId);
    setIsDeleting(false);

    if (!res.ok) {
      toast.error(res.error || t('deleteConsumedFailed'));
      return;
    }

    if (referenceId === deleteConfirmId) resetEdit();
    setDeleteConfirmId(null);
    router.refresh();
  };

  return (
    <div className="h-full w-full overflow-y-auto space-y-6 pb-24 px-4 pt-4">
      <div className="flex items-start justify-between">
        <PageHeader
          title={<>{t('consumedIngredients')}</>}
          description={<>{t('consumedIngredientsDesc')}</>}
          eyebrow={<>{t('eyebrow')}</>}
        />
        <Link
          href="/pos/manual-sales"
          className="inline-flex items-center justify-center rounded-lg bg-brand-cream px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-2 border border-brand-cream-3"
        >
          &larr; {t('backToSales')}
        </Link>
      </div>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <form
          id="consumed-ingredients-form"
          action={submitAction}
          className="grid gap-4 lg:grid-cols-4"
        >
          <input type="hidden" name="referenceId" value={referenceId ?? ''} />
          <Field label={t('location')}>
            <Select
              name="locationId"
              value={editLocationId}
              onChange={(event) => setEditLocationId(event.target.value)}
              required
            >
              {data.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('date')}>
            <Input
              name="date"
              type="date"
              value={entryDate}
              onChange={(event) => setEntryDate(event.target.value)}
              required
            />
          </Field>
          <Field label={t('notes')}>
            <Input
              name="notes"
              type="text"
              value={entryNotes}
              onChange={(event) => setEntryNotes(event.target.value)}
              placeholder={t('notesPlaceholder')}
            />
          </Field>

          <div className="lg:col-span-4 rounded-xl border border-brand-cream-3 p-4 mt-4">
            <h3 className="mb-3 text-sm font-semibold text-brand-ink">
              {t('consumedIngredients')}
            </h3>
            <div className="space-y-3">
              {consumedIngredients.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-end gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream-2/50 p-3"
                >
                  <div className="flex-1 min-w-[200px]">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {t('ingredient')}
                    </span>
                    <SearchableSelect
                      options={[
                        { value: '', label: t('selectIngredient') },
                        ...data.ingredients.map((p) => ({
                          value: p.id,
                          label: `${p.name} (${p.uom})`,
                        })),
                      ]}
                      value={item.ingredientId}
                      searchPlaceholder={t('search')}
                      emptyMessage={t('noResultsFound')}
                      onChange={(val) => {
                        const ingredient = data.ingredients.find((p) => p.id === val);
                        if (!ingredient) return;
                        const newItems = [...consumedIngredients];
                        newItems[index] = {
                          ingredientId: ingredient.id,
                          name: ingredient.name,
                          qty: newItems[index]?.qty || '',
                          uom: ingredient.uom,
                        };
                        setConsumedIngredients(newItems);
                      }}
                    />
                  </div>
                  <div className="w-24">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {t('qty')}
                    </span>
                    <Input
                      type="number"
                      min={1}
                      step="1"
                      value={item.qty}
                      onKeyDown={(e) => {
                        if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const qty = raw === '' ? '' : Math.max(1, Number.parseInt(raw, 10) || 0);
                        const newItems = [...consumedIngredients];
                        newItems[index] = { ...newItems[index]!, qty };
                        setConsumedIngredients(newItems);
                      }}
                    />
                  </div>
                  <div className="w-24">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {t('uom')}
                    </span>
                    <Input type="text" readOnly value={item.uom} className="bg-brand-cream/50" />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-brand-red mb-1"
                    onClick={() => {
                      setConsumedIngredients(consumedIngredients.filter((_, i) => i !== index));
                    }}
                  >
                    {t('delete')}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setConsumedIngredients([
                    ...consumedIngredients,
                    { ingredientId: '', name: '', qty: 1, uom: '' },
                  ]);
                }}
              >
                + {t('addIngredient')}
              </Button>
            </div>
            <input
              type="hidden"
              name="consumedIngredientsJson"
              value={JSON.stringify(consumedIngredients.filter((i) => i.ingredientId && i.qty).map(i => ({ ...i, qty: i.qty || 1 })))}
            />
          </div>

          <div className="lg:col-span-4 flex items-end">
            <Button
              type="submit"
              disabled={isPending || consumedIngredients.filter((i) => i.ingredientId).length === 0}
              className="w-full rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
              variant="primary"
              size="lg"
            >
              {isPending ? t('posting') : referenceId ? t('updateConsumed') : t('post')}
            </Button>
            {referenceId ? (
              <Button type="button" variant="ghost" className="ml-3" onClick={resetEdit}>
                {t('cancel')}
              </Button>
            ) : null}
          </div>
          {state?.error ? (
            <div className="lg:col-span-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {state.error}
            </div>
          ) : null}
          {state?.ok ? (
            <div className="lg:col-span-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {t('posted')}
            </div>
          ) : null}
        </form>
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <div className="border-b border-brand-cream-3 px-5 py-4">
          <h2 className="text-base font-semibold text-brand-ink">{t('consumedHistory')}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input
              type="date"
              value={historyDateFrom}
              onChange={(e) => setHistoryDateFrom(e.target.value)}
              placeholder={t('dateFrom')}
              className="w-36 text-sm"
            />
            <Input
              type="date"
              value={historyDateTo}
              onChange={(e) => setHistoryDateTo(e.target.value)}
              placeholder={t('dateTo')}
              className="w-36 text-sm"
            />
            <Select
              value={historyLocationFilter}
              onChange={(e) => setHistoryLocationFilter(e.target.value)}
              className="w-40 text-sm"
            >
              <option value="">{t('allLocations')}</option>
              {data.locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.label}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <thead className="bg-brand-cream">
              <tr className="text-left text-brand-ink-2">
                <Th>{t('date')}</Th>
                <Th>{t('location')}</Th>
                <Th>{t('itemCount')}</Th>
                <Th>{t('notes')}</Th>
                <Th>{t('postedBy')}</Th>
                <Th align="right">{t('actions')}</Th>
              </tr>
            </thead>
            <TableBody className="divide-y divide-brand-cream-3">
              {(() => {
                const filtered = data.history.items.filter((item) => {
                  const dateStr = toWibDate(item.occurredAt);
                  if (historyDateFrom && dateStr < historyDateFrom) return false;
                  if (historyDateTo && dateStr > historyDateTo) return false;
                  if (historyLocationFilter && item.locationId !== historyLocationFilter) return false;
                  return true;
                });
                return filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-brand-ink-3">
                    {t('emptyConsumedHistory')}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="text-brand-ink hover:bg-brand-cream/50">
                    <Td>{toWibDate(item.occurredAt)}</Td>
                    <Td>{item.locationLabel || '-'}</Td>
                    <Td>
                      <div className="text-sm font-medium text-brand-ink">
                        {t('itemCountSummary', { count: item.itemCount })}
                      </div>
                      <ExpandableItemList
                        items={item.items}
                        formatQty={formatHistoryQty}
                        moreLabel={(count: number) => t('moreItems', { count })}
                        collapseLabel={t('showLess', { defaultValue: 'Lebih sedikit' })}
                      />
                    </Td>
                    <Td>
                      {item.notes ? (
                        <span className="text-sm text-brand-ink-2">{item.notes}</span>
                      ) : (
                        <span className="text-brand-ink-3">—</span>
                      )}
                    </Td>
                    <Td>
                      {item.createdByName || '-'}
                      {item.updatedByName && item.updatedByName !== item.createdByName ? (
                        <span className="mt-0.5 block text-[11px] text-brand-ink-3">
                          {t('editedBy', { name: item.updatedByName })}
                        </span>
                      ) : null}
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={loadingDetailId === item.id}
                          onClick={() => startEdit(item.id)}
                        >
                          {loadingDetailId === item.id ? t('loadingDetail') : t('edit')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-brand-red"
                          onClick={() => setDeleteConfirmId(item.id)}
                        >
                          {t('delete')}
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))
              );
              })()}
            </TableBody>
          </Table>
        </div>
        <Pagination
          currentPage={data.history.page}
          totalItems={data.history.total}
          pageSize={data.history.pageSize}
        />
      </section>

      {deleteConfirmId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <button
            type="button"
            aria-label={t('close')}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isDeleting && setDeleteConfirmId(null)}
          />
          <div className="relative z-10 flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-brand-cream-3 bg-brand-cream px-6 py-4">
              <h3 className="text-lg font-semibold text-brand-ink">
                {t('confirmDeleteConsumedTitle')}
              </h3>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmId(null)}
                className="text-brand-ink-3 hover:text-brand-ink disabled:opacity-50"
              >
                &times;
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-brand-ink-2">{t('confirmDeleteConsumed')}</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-brand-cream-3 bg-brand-cream p-4">
              <Button
                type="button"
                variant="ghost"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmId(null)}
              >
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={isDeleting}
                className="bg-brand-red text-white hover:bg-brand-red-dark"
                onClick={executeDelete}
              >
                {isDeleting ? t('deleting') : t('delete')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-brand-ink">{label}</span>
      {children}
    </label>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <TableHead
      className={`px-4 py-3 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </TableHead>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <TableCell
      className={`whitespace-nowrap px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </TableCell>
  );
}
