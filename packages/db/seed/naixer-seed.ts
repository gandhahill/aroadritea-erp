/**
 * Naixer KDS default seed — SD §33.2
 *
 * Seeds default QR format config for each location.
 * Product/modifier codes are entered via UI or CSV import (T-0083).
 */

export const NAIXER_QR_FORMAT_DEFAULTS = [
  {
    locationCode: 'MLI', // Malioboro
    format: 'dash' as const,
    includeOrderId: false,
    parameterOrder: ['product', 'size', 'ice', 'sugar'],
    labelWidthMm: 60,
    labelHeightMm: 40,
  },
  {
    locationCode: 'JKT', // Jakarta
    format: 'dash' as const,
    includeOrderId: false,
    parameterOrder: ['product', 'size', 'ice', 'sugar'],
    labelWidthMm: 60,
    labelHeightMm: 40,
  },
];
