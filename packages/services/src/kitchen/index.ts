export { generateQrPayload } from './generate-qr';
export type { GenerateQRInput, QRPayloadResult } from './generate-qr';
export {
  dashStrategy,
  pipeStrategy,
  getStrategy,
  wrapDemo,
  isDemo,
  unwrapDemo,
  STRATEGIES,
} from './qr-strategy';
export type { NaixerQRPayload, QRStrategy } from './qr-strategy';
export { parseProductCodesCsv, parseModifierCodesCsv } from './parse-naixer-csv';
export type {
  ProductCodeRow,
  ModifierCodeRow,
  ParseResult,
} from './parse-naixer-csv';
export {
  queueOrderItems,
  updateKdsStatus,
  listKdsItems,
  getKdsStats,
  cancelOrderItems,
  isValidTransition,
} from './kds-service';
export type {
  KdsStatus,
  QueueOrderItemsInput,
  UpdateKdsStatusInput,
  ListKdsItemsInput,
  KdsItemResult,
  KdsStatsResult,
} from './kds-service';
