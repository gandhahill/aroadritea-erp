/**
 * POS services barrel — T-0057
 */

export { createSale, voidSale } from './create-sale';
export { openShift, closeShift, getOpenShift } from './shift-service';
export {
  ChannelSchema,
  OpenShiftInputSchema,
  CloseShiftInputSchema,
  CreateSaleInputSchema,
  VoidSaleInputSchema,
  ShiftStatusSchema,
  type Channel,
  type OpenShiftInput,
  type CloseShiftInput,
  type CreateSaleInput,
  type VoidSaleInput,
  type ShiftStatus,
  type SaleResult,
  type SaleLineResult,
  type PaymentResult,
  type ShiftResult,
} from './schemas';
