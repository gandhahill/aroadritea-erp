/**
 * Demo Receipt Print Page — SD §34, ADR-0008
 *
 * Renders the same 80mm thermal-friendly layout as the real receipt
 * page but reads the order from sessionStorage. Demo POS never persists
 * to the server, so we ship the demo order through sessionStorage when
 * the cashier triggers print.
 *
 * The watermark "DEMO" is added so a misprinted demo receipt can't be
 * confused for a real transaction.
 */

import type { Metadata } from 'next';
import { DemoReceiptClient } from './receipt-client';

export const metadata: Metadata = { title: '[DEMO] Receipt' };

export default function DemoReceiptPage() {
  return <DemoReceiptClient />;
}
