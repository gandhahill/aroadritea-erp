/**
 * Shift Status Bar — SD §21.4
 *
 * Fixed bar at the top of the POS screen.
 * Shows open shift info, or a button to open a shift.
 * Pulls current shift status from the server action.
 */

'use client';

import { FileUploadField } from '@/components/file-upload-field';
import { Input } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  closeShiftAction,
  fetchOpenShift,
  openShiftAction,
  recordShiftExpenseAction,
} from './actions';
import type { ShiftStatusItem } from './actions';
import { usePosCart } from './pos-cart-context';

interface ShiftStatusBarProps {
  locationId: string;
  tenantId: string;
}

export function ShiftStatusBar({ locationId, tenantId }: ShiftStatusBarProps) {
  const t = useTranslations('pos');
  const router = useRouter();
  const pathname = usePathname();
  const { setShiftId } = usePosCart();
  const [shift, setShift] = useState<ShiftStatusItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  // Controlled inputs — reading from DOM via `form.elements.namedItem`
  // worked, but the previous implementation also lost values whenever
  // the modal re-rendered (e.g., when `closeError` updated), making the
  // "Konfirmasi" button feel like it did nothing on the second click.
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [actualCashInput, setActualCashInput] = useState('');

  // Shift Expense state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmountInput, setExpenseAmountInput] = useState('');
  const [expenseDescInput, setExpenseDescInput] = useState('');
  const [expenseAttachmentUrl, setExpenseAttachmentUrl] = useState('');
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Demo route lives under the same parent layout but uses an isolated
  // IndexedDB sandbox (ADR-0008). The production shift bar must not
  // appear there — otherwise clicking "Open Shift" while in demo mode
  // creates a real shift on the production server.
  const isDemoRoute = pathname?.startsWith('/pos/demo');

  // Load open shift on mount
  useEffect(() => {
    if (isDemoRoute) return;
    startTransition(async () => {
      const s = await fetchOpenShift(locationId);
      setShift(s);
      setShiftId(s?.id ?? null);
    });
  }, [locationId, setShiftId, isDemoRoute]);

  if (isDemoRoute) return null;

  // Refresh expectedCash from server every time the close modal opens
  async function openCloseModal() {
    setCloseError(null);
    setActualCashInput('');
    setShowCloseModal(true);
    const fresh = await fetchOpenShift(locationId);
    if (fresh) setShift(fresh);
  }

  function openOpenModal() {
    setOpenError(null);
    setOpeningCashInput('');
    setShowOpenModal(true);
  }

  async function handleOpenShift(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const openingCash = openingCashInput.replace(/\D/g, '');
    if (!openingCash) {
      setOpenError(translateErr(t, 'openingCashRequired'));
      return;
    }
    setOpenError(null);
    startTransition(async () => {
      const result = await openShiftAction({ locationId, openingCash });
      if (result.ok && result.value) {
        setShift(result.value as ShiftStatusItem);
        setShiftId(result.value.id);
        setShowOpenModal(false);
        setOpeningCashInput('');
      } else if (!result.ok) {
        const key =
          (result.error as { messageKey?: string } | undefined)?.messageKey ?? 'shiftOpenFailed';
        setOpenError(translateErr(t, key));
      }
    });
  }

  async function handleCloseShift(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shift) return;
    const actualCash = actualCashInput.replace(/\D/g, '');
    if (!actualCash) {
      // Empty input would fail the server-side `^\d+$` regex with a
      // generic validation error that confused cashiers. Surface it
      // here instead so they immediately see what's missing.
      setCloseError(translateErr(t, 'actualCashRequired'));
      return;
    }
    setCloseError(null);

    // Re-fetch the shift right before close so the optimistic version
    // we send matches what's in the DB. The previous hardcoded `version: 1`
    // silently failed for any shift whose row had been touched (e.g.,
    // after a future re-open, edit, or migration update).
    startTransition(async () => {
      const fresh = await fetchOpenShift(locationId);
      const versionToSend = fresh?.version ?? shift.version ?? 1;
      const result = await closeShiftAction({
        shiftId: shift.id,
        actualCash,
        version: versionToSend,
      });
      if (result.ok) {
        setShift(null);
        setShiftId(null);
        setShowCloseModal(false);
        setActualCashInput('');
        router.refresh();
      } else {
        const key =
          (result.error as { messageKey?: string } | undefined)?.messageKey ?? 'shiftCloseFailed';
        setCloseError(translateErr(t, key));
      }
    });
  }

  async function handleRecordExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shift) return;
    const amount = expenseAmountInput.replace(/\D/g, '');
    if (!amount || Number(amount) <= 0) {
      setExpenseError(t('amountRequired'));
      return;
    }
    if (!expenseDescInput.trim()) {
      setExpenseError(t('expenseDescRequired'));
      return;
    }
    setExpenseError(null);

    startTransition(async () => {
      const result = await recordShiftExpenseAction({
        shiftId: shift.id,
        amount,
        description: expenseDescInput.trim(),
        attachmentUrl: expenseAttachmentUrl || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      if (result.ok) {
        setShowExpenseModal(false);
        setExpenseAmountInput('');
        setExpenseDescInput('');
        setExpenseAttachmentUrl('');
        // Refresh shift so expectedCash updates immediately
        const fresh = await fetchOpenShift(locationId);
        if (fresh) setShift(fresh);
      } else {
        const key =
          (result.error as { messageKey?: string } | undefined)?.messageKey ?? 'systemError';
        setExpenseError(translateErr(t as any, key));
      }
    });
  }

  const isOpen = shift?.status === 'open';

  return (
    <>
      <div className="flex h-12 items-center justify-between border-b border-brand-cream-3 bg-card px-4">
        {/* Shift status */}
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-2 w-2 rounded-full ${isOpen ? 'bg-brand-jade' : 'bg-brand-ink-3'}`}
          />
          <span className="text-sm font-medium text-brand-ink">
            {isOpen ? t('shiftOpen') : t('noShiftOpen')}
          </span>
          {isOpen && shift && (
            <span className="text-xs text-brand-ink-3">
              · {t('openingCash')}: {formatRupiah(shift.openingCash)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              window.open(
                `/display?tenant=${encodeURIComponent(tenantId)}&location=${encodeURIComponent(locationId)}`,
                `pos-display-${tenantId}-${locationId}`,
                'width=1024,height=768',
              )
            }
            className="h-8 rounded-md border border-brand-cream-3 bg-card px-3 text-xs font-medium text-brand-ink hover:bg-brand-cream-2 disabled:opacity-50"
          >
            {t('customerDisplay')}
          </button>

          {isOpen ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setExpenseError(null);
                  setExpenseAmountInput('');
                  setExpenseDescInput('');
                  setExpenseAttachmentUrl('');
                  setShowExpenseModal(true);
                }}
                className="h-8 rounded-md border border-brand-cream-3 bg-card px-3 text-xs font-medium text-brand-ink hover:bg-brand-cream-2 disabled:opacity-50"
                disabled={isPending}
              >
                {t('drawerExpense')}
              </button>
              <button
                type="button"
                onClick={openCloseModal}
                className="h-8 rounded-md border border-brand-cream-3 bg-card px-3 text-xs font-medium text-brand-ink hover:bg-brand-cream-2 disabled:opacity-50"
                disabled={isPending}
              >
                {t('closeShift')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={openOpenModal}
              className="h-8 rounded-md bg-brand-red px-3 text-xs font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
              disabled={isPending}
            >
              {t('openShift')}
            </button>
          )}
        </div>
      </div>

      {/* Open Shift Modal */}
      {showOpenModal && (
        <Modal onClose={() => setShowOpenModal(false)}>
          <div className="surface-card p-6">
            <h2 className="mb-5 text-lg font-bold text-brand-ink">{t('openShift')}</h2>
            <form onSubmit={handleOpenShift} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="openingCash"
                  className="mb-1.5 block text-sm font-medium text-brand-ink-2"
                >
                  {t('openingCash')}
                </label>
                <Input
                  id="openingCash"
                  name="openingCash"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  required
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value.replace(/\D/g, ''))}
                  className="h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
                />
              </div>
              {openError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {openError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="h-10 rounded-md border border-brand-cream-3 bg-card px-4 text-sm font-medium text-brand-ink hover:bg-brand-cream-2"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-10 rounded-md bg-brand-red px-4 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
                >
                  {isPending ? t('loading') : t('confirm')}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Close Shift Modal */}
      {showCloseModal && shift && (
        <Modal onClose={() => setShowCloseModal(false)}>
          <div className="surface-card p-6">
            <h2 className="mb-5 text-lg font-bold text-brand-ink">{t('closeShift')}</h2>
            <form onSubmit={handleCloseShift} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="expectedCash"
                  className="mb-1.5 block text-sm font-medium text-brand-ink-2"
                >
                  {t('expectedCash')}
                </label>
                <Input
                  id="expectedCash"
                  type="text"
                  value={formatRupiah(shift.expectedCash ?? '0')}
                  readOnly
                  className="h-10 w-full cursor-not-allowed rounded-md border border-brand-cream-3 bg-brand-cream-2 px-3 text-sm text-brand-ink-3"
                />
              </div>
              <div>
                <label
                  htmlFor="actualCash"
                  className="mb-1.5 block text-sm font-medium text-brand-ink-2"
                >
                  {t('actualCash')}
                </label>
                <Input
                  id="actualCash"
                  name="actualCash"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  required
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value.replace(/\D/g, ''))}
                  className="h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
                />
              </div>
              {closeError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {closeError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="h-10 rounded-md border border-brand-cream-3 bg-card px-4 text-sm font-medium text-brand-ink hover:bg-brand-cream-2"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-10 rounded-md bg-brand-red px-4 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
                >
                  {isPending ? t('loading') : t('confirm')}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Drawer Expense Modal */}
      {showExpenseModal && shift && (
        <Modal onClose={() => setShowExpenseModal(false)}>
          <div className="surface-card p-6">
            <h2 className="mb-5 text-lg font-bold text-brand-ink">{t('drawerExpense')}</h2>
            <form onSubmit={handleRecordExpense} className="flex flex-col gap-4">
              <p className="text-sm text-brand-ink-3">{t('expenseHint')}</p>
              <div>
                <label
                  htmlFor="expenseAmount"
                  className="mb-1.5 block text-sm font-medium text-brand-ink-2"
                >
                  {t('expenseAmountLabel')}
                </label>
                <Input
                  id="expenseAmount"
                  name="expenseAmount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  required
                  value={expenseAmountInput}
                  onChange={(e) => setExpenseAmountInput(e.target.value.replace(/\D/g, ''))}
                  className="h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
                />
              </div>
              <div>
                <label
                  htmlFor="expenseDesc"
                  className="mb-1.5 block text-sm font-medium text-brand-ink-2"
                >
                  {t('expenseDescRequired')}
                </label>
                <Input
                  id="expenseDesc"
                  name="expenseDesc"
                  type="text"
                  placeholder={t('expenseDescPlaceholder')}
                  required
                  value={expenseDescInput}
                  onChange={(e) => setExpenseDescInput(e.target.value)}
                  className="h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
                />
              </div>
              <div>
                <FileUploadField
                  label={t('expenseAttachment')}
                  hiddenName="attachmentUrl"
                  value={expenseAttachmentUrl}
                  area="shift-expenses"
                  visibility="private"
                  onChange={(url) => setExpenseAttachmentUrl(url)}
                />
              </div>
              {expenseError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {expenseError}
                </p>
              )}
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="h-10 rounded-md border border-brand-cream-3 bg-card px-4 text-sm font-medium text-brand-ink hover:bg-brand-cream-2"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-10 rounded-md bg-brand-red px-4 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
                >
                  {isPending ? t('processing') : t('recordExpense')}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}

function translateErr(t: ReturnType<typeof useTranslations>, key: string): string {
  // Stub: most server-side AppError messageKeys are pos.* under the
  // pos namespace, but messages may not have entries for every key. Fall
  // back to the raw key so the user at least sees something actionable.
  try {
    const localized = t(key);
    return localized && localized !== key ? localized : key;
  } catch {
    return key;
  }
}

// ─── Utility helpers ───────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-brand-ink-3 hover:text-brand-ink"
          aria-label="close"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}

function formatRupiah(value: string | bigint): string {
  const num = Number(value);
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}
