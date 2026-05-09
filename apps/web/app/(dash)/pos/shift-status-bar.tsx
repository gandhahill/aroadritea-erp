/**
 * Shift Status Bar — SD §21.4
 *
 * Fixed bar at the top of the POS screen.
 * Shows open shift info, or a button to open a shift.
 * Pulls current shift status from the server action.
 */

'use client';

import { useState, useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { fetchOpenShift, openShiftAction, closeShiftAction } from './actions';
import { usePosCart } from './pos-cart-context';
import type { ShiftStatusItem } from './actions';

interface ShiftStatusBarProps {
  locationId: string;
  tenantId: string;
}

export function ShiftStatusBar({ locationId, tenantId }: ShiftStatusBarProps) {
  const t = useTranslations('pos');
  const { setShiftId } = usePosCart();
  const [shift, setShift] = useState<ShiftStatusItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Load open shift on mount
  useEffect(() => {
    startTransition(async () => {
      const s = await fetchOpenShift(locationId);
      setShift(s);
      setShiftId(s?.id ?? null);
    });
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOpenShift(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const openingCash = (form.elements.namedItem('openingCash') as HTMLInputElement).value;
    startTransition(async () => {
      const result = await openShiftAction({ locationId, openingCash });
      if (result.ok && result.value) {
        setShift(result.value as ShiftStatusItem);
        setShiftId(result.value.id);
        setShowOpenModal(false);
      }
    });
  }

  async function handleCloseShift(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const actualCash = (form.elements.namedItem('actualCash') as HTMLInputElement).value;
    if (!shift) return;
    startTransition(async () => {
      const result = await closeShiftAction({
        shiftId: shift.id,
        actualCash,
        version: 1,
      });
      if (result.ok) {
        setShift(null);
        setShiftId(null);
        setShowCloseModal(false);
      }
    });
  }

  const isOpen = shift?.status === 'open';

  return (
    <>
      <div className="flex h-12 items-center justify-between border-b border-brand-cream-3 bg-white px-4">
        {/* Shift status */}
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-2 w-2 rounded-full ${isOpen ? 'bg-brand-jade' : 'bg-brand-ink-3'}`} />
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
        <div>
          {isOpen ? (
            <button
              onClick={() => setShowCloseModal(true)}
              className="h-8 rounded-md border border-brand-cream-3 bg-white px-3 text-xs font-medium text-brand-ink hover:bg-brand-cream-2 disabled:opacity-50"
              disabled={isPending}
            >
              {t('closeShift')}
            </button>
          ) : (
            <button
              onClick={() => setShowOpenModal(true)}
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
                <label htmlFor="openingCash" className="mb-1.5 block text-sm font-medium text-brand-ink-2">
                  {t('openingCash')}
                </label>
                <input
                  id="openingCash"
                  name="openingCash"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  required
                  className="h-10 w-full rounded-md border border-brand-cream-3 bg-white px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowOpenModal(false)} className="h-10 rounded-md border border-brand-cream-3 bg-white px-4 text-sm font-medium text-brand-ink hover:bg-brand-cream-2">
                  {t('cancel')}
                </button>
                <button type="submit" disabled={isPending} className="h-10 rounded-md bg-brand-red px-4 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50">
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
                <label htmlFor="expectedCash" className="mb-1.5 block text-sm font-medium text-brand-ink-2">
                  {t('expectedCash')}
                </label>
                <input
                  id="expectedCash"
                  type="text"
                  value={formatRupiah(shift.expectedCash ?? '0')}
                  readOnly
                  className="h-10 w-full cursor-not-allowed rounded-md border border-brand-cream-3 bg-brand-cream-2 px-3 text-sm text-brand-ink-3"
                />
              </div>
              <div>
                <label htmlFor="actualCash" className="mb-1.5 block text-sm font-medium text-brand-ink-2">
                  {t('actualCash')}
                </label>
                <input
                  id="actualCash"
                  name="actualCash"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  required
                  className="h-10 w-full rounded-md border border-brand-cream-3 bg-white px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCloseModal(false)} className="h-10 rounded-md border border-brand-cream-3 bg-white px-4 text-sm font-medium text-brand-ink hover:bg-brand-cream-2">
                  {t('close')}
                </button>
                <button type="submit" disabled={isPending} className="h-10 rounded-md bg-brand-red px-4 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50">
                  {isPending ? t('loading') : t('confirm')}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── Utility helpers ───────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 text-brand-ink-3 hover:text-brand-ink" aria-label="close">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
  if (isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
}
