'use client';

import { useEffect } from 'react';

interface Props {
  /** See ReceiptAutoPrint for semantics. */
  kioskPrinting?: boolean;
  printerName?: string | null;
}

export function LabelAutoPrint({ kioskPrinting = false, printerName }: Props = {}) {
  useEffect(() => {
    const delay = kioskPrinting ? 0 : 250;
    const id = window.setTimeout(() => window.print(), delay);
    return () => window.clearTimeout(id);
  }, [kioskPrinting]);
  return (
    <span hidden data-printer={printerName ?? ''} data-kiosk={kioskPrinting ? 'true' : 'false'} />
  );
}
