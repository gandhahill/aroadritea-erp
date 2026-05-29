import { openDB } from 'idb';
import type { CartState } from './pos-cart-context';

export interface ParkedCart {
  id: string;
  name: string;
  parkedAt: Date;
  state: CartState;
}

const DB_NAME = 'pos-parked-carts';
const STORE_NAME = 'carts';

export async function getParkedCartsDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export async function saveParkedCart(cart: ParkedCart) {
  const db = await getParkedCartsDB();
  await db.put(STORE_NAME, cart);
}

export async function getParkedCarts(): Promise<ParkedCart[]> {
  const db = await getParkedCartsDB();
  return db.getAll(STORE_NAME);
}

export async function deleteParkedCart(id: string) {
  const db = await getParkedCartsDB();
  await db.delete(STORE_NAME, id);
}
