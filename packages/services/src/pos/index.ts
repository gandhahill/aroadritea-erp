/**
 * POS services barrel — T-0057 + T-0058 + T-0081a
 */

export { createSale, voidSale } from './create-sale';
export {
  createManualSalesClosing,
  listManualSalesClosings,
  listManualSalesLocations,
} from './manual-sales';
export { refundSale } from './refund-sale';
export { openShift, closeShift, getOpenShift } from './shift-service';

// SD §25.11 — Donation / Rounding
export {
  calculateDonation,
  getDonationOptions,
  type DonationChoice,
  type DonationResult,
  type RoundingOption,
} from './donation';

// Schemas
export {
  ChannelSchema,
  RoundingOptionSchema,
  OpenShiftInputSchema,
  CloseShiftInputSchema,
  CreateSaleInputSchema,
  CreateManualSalesClosingInputSchema,
  VoidSaleInputSchema,
  RefundSaleInputSchema,
  ShiftStatusSchema,
  type Channel,
  type OpenShiftInput,
  type CloseShiftInput,
  type CreateSaleInput,
  type CreateManualSalesClosingInput,
  type VoidSaleInput,
  type RefundSaleInput,
  type RefundLineInput,
  type ShiftStatus,
  type SaleResult,
  type SaleLineResult,
  type PaymentResult,
  type ShiftResult,
  type ManualSalesClosingResult,
} from './schemas';
