import 'dotenv/config'; // will load root .env
import { inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { products, stockLevels, stockMovements } from './packages/db/schema/inventory';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is missing');

  console.log('Connecting to', connectionString.split('@')[1]);
  const sql = postgres(connectionString);
  const db = drizzle(sql);

  console.log('Fetching supplies...');
  const supplies = await db
    .select({ id: products.id })
    .from(products)
    .where(inArray(products.kind, ['raw_material', 'consumable', 'merchandise', 'service']));

  const ids = supplies.map((s) => s.id);

  if (ids.length === 0) {
    console.log('No supplies found.');
    process.exit(0);
  }

  console.log(`Found ${ids.length} supplies to delete.`);

  console.log('Deleting stock movements...');
  await db.delete(stockMovements).where(inArray(stockMovements.productId, ids));

  console.log('Deleting stock levels...');
  await db.delete(stockLevels).where(inArray(stockLevels.productId, ids));

  console.log('Deleting products...');
  await db.delete(products).where(inArray(products.id, ids));

  console.log('Done!');
  process.exit(0);
}

main().catch(console.error);
