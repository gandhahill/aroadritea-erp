/**
 * Demo Shift Bar — visual parity with production shift bar.
 *
 * State lives purely in sessionStorage (`aroadri:demo:shift`). It never
 * touches the real `shifts` table — opening a "demo shift" here cannot
 * appear in production POS, accounting reports, or audit trail.
 *
 * Mirrors `ShiftStatusBar` so cashiers practicing on demo see the same
 * open/close flow they'll see at the real till.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface DemoShiftState {
  id: string;
  openingCash: string;
  openedAt: string;
}

const STORAGE_KEY = 'aroadri:demo:shift';

function readDemoShift(): DemoShiftState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoShiftState;
  } catch {
    return null;
  }
}

function writeDemoShift(s: DemoShiftState | null) {
  if (typeof window === 'undefined') return;
  try {
    if (s === null) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota or disabled storage — ignore */
  }
}

function formatRupiah(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function DemoShiftBar() {
  const t = useTranslations('pos');
  const [shift, setShift] = useState<DemoShiftState | null>(null);
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [openError, setOpenError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  useEffect(() => {
    setShift(readDemoShift());
  }, []);

  function handleOpen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cash = openingCash.replace(/\D/g, '');
    if (!cash) {
      setOpenError(t('openingCashRequired'));
      return;
    }
    const next: DemoShiftState = {
      id: `demo-${Date.now()}`,
      openingCash: cash,
      openedAt: new Date().toISOString(),
    };
    writeDemoShift(next);
    setShift(next);
    setShowOpen(false);
    setOpeningCash('');
    setOpenError(null);
  }

  function handleClose(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cash = actualCash.replace(/\D/g, '');
    if (!cash) {
      setCloseError(t('actualCashRequired'));
      return;
    }
    writeDemoShift(null);
    setShift(null);
    setShowClose(false);
    setActualCash('');
    setCloseError(null);
  }

  const isOpen = shift !== null;

  return (
    <>
      <div className="flex h-12 items-center justify-between border-b border-brand-cream-3 bg-brand-cream-1/50 px-4">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-2 w-2 rounded-full ${isOpen ? 'bg-brand-jade' : 'bg-brand-ink-3'}`}
          />
          <span className="text-sm font-medium text-brand-ink">
            [DEMO] {isOpen ? t('shiftOpen') : t('noShiftOpen')}
          </span>
          {isOpen && shift && (
            <span className="text-xs text-brand-ink-3">
              · {t('openingCash')}: {formatRupiah(shift.openingCash)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOpen ? (
            <button
              type="button"
              onClick={() => {
                setCloseError(null);
                setActualCash('');
                setShowClose(true);
              }}
              className="h-8 rounded-md border border-brand-cream-3 bg-card px-3 text-xs font-medium text-brand-ink hover:bg-brand-cream-2"
            >
              {t('closeShift')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpenError(null);
                setOpeningCash('');
                setShowOpen(true);
              }}
              className="h-8 rounded-md bg-brand-red px-3 text-xs font-medium text-white hover:bg-brand-red-dark"
            >
              {t('openShift')}
            </button>
          )}
        </div>
      </div>

      {showOpen && (
        <DemoShiftModal onClose={() => setShowOpen(false)}>
          <h2 className="mb-5 text-lg font-bold text-brand-ink">
            [DEMO] {t('openShift')}
          </h2>
          <p className="mb-4 text-xs text-brand-ink-3">
            Shift demo tidak masuk ke database POS asli.
          </p>
          <form onSubmit={handleOpen} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="demoOpeningCash"
                className="mb-1.5 block text-sm font-medium text-brand-ink-2"
              >
                {t('openingCash')}
              </label>
              <input
                id="demoOpeningCash"
                type="text"
                inputMode="numeric"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                required
                className="h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink"
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
                onClick={() => setShowOpen(false)}
                className="h-10 rounded-md border border-brand-cream-3 bg-card px-4 text-sm font-medium text-brand-ink hover:bg-brand-cream-2"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="h-10 rounded-md bg-brand-red px-4 text-sm font-medium text-white hover:bg-brand-red-dark"
              >
                {t('confirm')}
              </button>
            </div>
          </form>
        </DemoShiftModal>
      )}

      {showClose && shift && (
        <DemoShiftModal onClose={() => setShowClose(false)}>
          <h2 className="mb-5 text-lg font-bold text-brand-ink">
            [DEMO] {t('closeShift')}
          </h2>
          <form onSubmit={handleClose} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="demoExpectedCash"
                className="mb-1.5 block text-sm font-medium text-brand-ink-2"
              >
                {t('expectedCash')}
              </label>
              <input
                id="demoExpectedCash"
                type="text"
                value={formatRupiah(shift.openingCash)}
                readOnly
                className="h-10 w-full cursor-not-allowed rounded-md border border-brand-cream-3 bg-brand-cream-2 px-3 text-sm text-brand-ink-3"
              />
            </div>
            <div>
              <label
                htmlFor="demoActualCash"
                className="mb-1.5 block text-sm font-medium text-brand-ink-2"
              >
                {t('actualCash')}
              </label>
              <input
                id="demoActualCash"
                type="text"
                inputMode="numeric"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                required
                className="h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink"
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
                onClick={() => setShowClose(false)}
                className="h-10 rounded-md border border-brand-cream-3 bg-card px-4 text-sm font-medium text-brand-ink hover:bg-brand-cream-2"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="h-10 rounded-md bg-brand-red px-4 text-sm font-medium text-white hover:bg-brand-red-dark"
              >
                {t('confirm')}
              </button>
            </div>
          </form>
        </DemoShiftModal>
      )}
    </>
  );
}

function DemoShiftModal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
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
