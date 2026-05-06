/**
 * InventoryPort — interface for inventory operations used by other modules.
 * SD §6.4: Service-to-service dependency via ports, not direct import.
 *
 * Example: POS module needs to deduct stock. POS depends on this port,
 * not on `packages/services/inventory` directly. Wiring happens in apps/*.
 */

import type { Result } from '../result';
import type { Money } from '../money';

export interface InventoryPort {
  /** Deduct stock for a product at a location. */
  deduct(
    productId: string,
    qty: number,
    locationId: string,
    reason: string,
  ): Promise<Result<void>>;

  /** Check available stock for a product at a location. */
  getAvailableQty(
    productId: string,
    locationId: string,
  ): Promise<Result<number>>;

  /** Get the cost price (COGS) for a product. */
  getCostPrice(
    productId: string,
    locationId: string,
  ): Promise<Result<Money>>;
}
