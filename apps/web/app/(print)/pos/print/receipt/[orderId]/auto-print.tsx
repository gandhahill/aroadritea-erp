'use client';

import { useEffect } from 'react';

interface Props {
  /**
   * When true, the cashier Chrome is expected to be launched with
   * `--kiosk-printing`; the browser will print silently without the
   * preview dialog. We skip the 250 ms delay so the operator doesn't
   * wait for nothing.
   */
  kioskPrinting?: boolean;
  /**
   * Hint to the local Print Bridge agent (Phase 2). Not currently
   * consumed by the browser, but emitted as a `data-printer` attribute
   * so a future userscript can route to the right device.
   */
  printerName?: string | null;
}

export function ReceiptAutoPrint({ kioskPrinting = false, printerName }: Props = {}) {
  useEffect(() => {
    const delay = kioskPrinting ? 0 : 250;
    const id = window.setTimeout(() => window.print(), delay);
    return () => window.clearTimeout(id);
  }, [kioskPrinting]);
  return (
    <span hidden data-printer={printerName ?? ''} data-kiosk={kioskPrinting ? 'true' : 'false'} />
  );
}
