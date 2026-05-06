import type { Result } from '../result';

export interface InventoryPort {
  deduct(productId: string, qty: number, locationId: string): Promise<Result<void>>;
}
