/**
 * POS services barrel — T-0057 + T-0058
 */

export { createSale, voidSale } from './create-sale';
export { refundSale } from './refund-sale';
export { openShift, closeShift, getOpenShift } from './shift-service';
export {
  ChannelSchema,
  OpenShiftInputSchema,
  CloseShiftInputSchema,
  CreateSaleInputSchema,
  VoidSaleInputSchema,
  RefundSaleInputSchema,
  ShiftStatusSchema,
  type Channel,
  type OpenShiftInput,
  type CloseShiftInput,
  type CreateSaleInput,
  type VoidSaleInput,
  type RefundSaleInput,
  type ShiftStatus,
  type SaleResult,
  type SaleLineResult,
  type PaymentResult,
  type ShiftResult,
} from './schemas';
