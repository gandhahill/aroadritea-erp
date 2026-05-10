/**
 * kitchen/qr-strategy.ts — QR payload encoding strategies (SD §33.3, ADR-0007)
 *
 * Strategy Pattern:
 * - Format B (dash): "T003-C01-S02-W01"  — default, proven in field
 * - Format A (pipe): "ORD0001|T003|C01,S02,W01" — vendor documented, not yet tested
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NaixerQRPayload {
  orderNumber?: string;
  productCode: string;
  specCodes: string[];
}

export interface QRStrategy {
  encode(payload: NaixerQRPayload): string;
  decode(raw: string): NaixerQRPayload | null;
}

// ─── Format B: Dash-separated (Default) ─────────────────────────────────────

export const dashStrategy: QRStrategy = {
  encode(payload: NaixerQRPayload): string {
    const parts = [payload.productCode, ...payload.specCodes];
    return parts.join('-');
  },

  decode(raw: string): NaixerQRPayload | null {
    const parts = raw.split('-');
    if (parts.length < 1) return null;
    return {
      productCode: parts[0]!,
      specCodes: parts.slice(1),
    };
  },
};

// ─── Format A: Pipe + comma (Vendor documented) ─────────────────────────────

export const pipeStrategy: QRStrategy = {
  encode(payload: NaixerQRPayload): string {
    const orderPart = payload.orderNumber ?? '';
    const specPart = payload.specCodes.join(',');
    return `${orderPart}|${payload.productCode}|${specPart}`;
  },

  decode(raw: string): NaixerQRPayload | null {
    const parts = raw.split('|');
    if (parts.length < 3) return null;
    return {
      orderNumber: parts[0] || undefined,
      productCode: parts[1]!,
      specCodes: parts[2]!.split(',').filter(Boolean),
    };
  },
};

// ─── Strategy registry ──────────────────────────────────────────────────────

export const STRATEGIES: Record<string, QRStrategy> = {
  dash: dashStrategy,
  pipe: pipeStrategy,
};

export function getStrategy(format: string): QRStrategy {
  const strategy = STRATEGIES[format];
  if (!strategy) {
    return dashStrategy;
  }
  return strategy;
}

// ─── Demo mode prefix (SD §33.5, §34.4) ────────────────────────────────────

const DEMO_PREFIX = 'DEMO-';

export function wrapDemo(payload: string, isDemo: boolean): string {
  return isDemo ? `${DEMO_PREFIX}${payload}` : payload;
}

export function isDemo(payload: string): boolean {
  return payload.startsWith(DEMO_PREFIX);
}

export function unwrapDemo(payload: string): string {
  return payload.startsWith(DEMO_PREFIX)
    ? payload.substring(DEMO_PREFIX.length)
    : payload;
}
