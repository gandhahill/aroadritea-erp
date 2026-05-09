/**
 * @erp/services/inventory — Inventory service barrel export.
 */

// Product CRUD
export { createProduct, type ProductResult } from './create-product';
export { updateProduct } from './update-product';
export { listProducts, getProduct, type ProductListItem, type ProductDetailResult, type VariantResult } from './list-products';

// Variant CRUD
export { createVariant, updateVariant } from './variant-crud';

// Category CRUD
export {
  createCategory,
  updateCategory,
  listCategories,
  buildCategoryTree,
  type CategoryResult,
  type CategoryTreeItem,
} from './category-crud';

// Schemas
export {
  CreateProductInputSchema,
  UpdateProductInputSchema,
  CreateVariantInputSchema,
  UpdateVariantInputSchema,
  CreateCategoryInputSchema,
  UpdateCategoryInputSchema,
  ListProductsInputSchema,
  CreateAdjustmentInputSchema,
  ApproveAdjustmentInputSchema,
  RejectAdjustmentInputSchema,
  CreateTransferInputSchema,
  ShipTransferInputSchema,
  ReceiveTransferInputSchema,
  AdjustmentReasonSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type CreateVariantInput,
  type UpdateVariantInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type ListProductsInput,
  type AdjustmentReason,
  type CreateAdjustmentInput,
  type ApproveAdjustmentInput,
  type RejectAdjustmentInput,
  type CreateTransferInput,
  type ShipTransferInput,
  type ReceiveTransferInput,
} from './schemas';

// Adjustment service
export {
  createAdjustmentDraft,
  submitAdjustment,
  approveAdjustment,
  rejectAdjustment,
  type AdjustmentResult,
  type AdjustmentLineResult,
} from './adjustment-service';

// Transfer service
export {
  createTransferDraft,
  shipTransfer,
  receiveTransfer,
  cancelTransfer,
  type TransferResult,
  type TransferLineResult,
} from './transfer-service';
