/**
 * @erp/services/inventory — Inventory service barrel export.
 */

// Product CRUD
export { createProduct, type ProductResult } from './create-product';
export { updateProduct } from './update-product';
export { deactivateProduct, reactivateProduct } from './deactivate-product';
export { deleteProductPermanently } from './delete-product';
export {
  setProductAvailability,
  type ProductAvailabilityResult,
} from './set-product-availability';
export {
  listProducts,
  getProduct,
  type ProductListItem,
  type ProductDetailResult,
  type VariantResult,
} from './list-products';

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
  updateTransferDraft,
  deleteTransfer,
  shipTransfer,
  receiveTransfer,
  cancelTransfer,
  type TransferResult,
  type TransferLineResult,
} from './transfer-service';

// Opname service
export {
  createOpnameDraft,
  recordCount,
  submitOpname,
  approveOpname,
  cancelOpname,
  getOpname,
  type OpnameResult,
  type OpnameLineResult,
} from './opname-service';

// Variance report
export {
  getVarianceReport,
  type VarianceReportParams,
  type VarianceReportResult,
  type VarianceSessionRow,
  type VarianceProductRow,
} from './variance-service';

// Import service (Excel Sheet 1 + Sheet 2)
export {
  importMasterFromExcel,
  importMovementsFromExcel,
  type Sheet1MasterRow,
  type Sheet2MovementRow,
  type ImportResult,
  type MovementImportResult,
  type ImportError,
} from './import-service';

export {
  getLowStockItems,
  getExpiringStock,
  type LowStockItem,
  type ExpiringStockItem,
} from './stock-alert-service';
export * from './uom-service';
export * from './uom-conversion-service';
export * from './ledger-service';
export * from './stock-depletion-service';
export * from './production-service';
export * from './waste-service';
export * from './stock-allocation-service';
