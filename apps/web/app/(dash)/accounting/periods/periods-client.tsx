'use client';

import { useState } from 'react';
import { OpenPeriodDialog } from './open-period-dialog';
import { ClosePeriodDialog } from './close-period-dialog';

interface OpenPeriodButtonProps {
  copy: any;
}

export function OpenPeriodButton({ copy }: OpenPeriodButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md bg-brand-jade px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-jade/90 shadow-sm"
      >
        {copy.period.openPeriod}
      </button>

      {isOpen && (
        <OpenPeriodDialog
          onClose={() => setIsOpen(false)}
          copy={copy.period}
        />
      )}
    </>
  );
}

interface ClosePeriodButtonProps {
  periodCode: string;
  draftCount: number;
  copy: any;
}

export function ClosePeriodButton({ periodCode, draftCount, copy }: ClosePeriodButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
        title={copy.period.closePeriod}
      >
        {copy.period.closePeriod}
      </button>

      {isOpen && (
        <ClosePeriodDialog
          periodCode={periodCode}
          draftCount={draftCount}
          onClose={() => setIsOpen(false)}
          copy={copy.period}
        />
      )}
    </>
  );
}
