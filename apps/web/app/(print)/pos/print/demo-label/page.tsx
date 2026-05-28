/**
 * Demo Cup Label Print Page — SD §34, ADR-0008
 *
 * Mirrors the production label layout for the cup-label thermal printer
 * but reads the demo order from sessionStorage. Watermarked "DEMO" so a
 * misprinted demo label is never confused for a real order.
 */

import type { Metadata } from 'next';
import { DemoLabelClient } from './label-client';

export const metadata: Metadata = { title: '[DEMO] Label | Aroadri ERP' };

export default function DemoLabelPage() {
  return <DemoLabelClient />;
}
