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
  type CreateProductInput,
  type UpdateProductInput,
  type CreateVariantInput,
  type UpdateVariantInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type ListProductsInput,
} from './schemas';
