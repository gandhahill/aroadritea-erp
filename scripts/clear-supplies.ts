import 'dotenv/config';
process.env.DATABASE_URL =
  'postgresql://aroadritea:local_erp_s3cr3t_2026@103.93.162.50:5432/aroadritea_erp';
import { inArray } from 'drizzle-orm';
import { db } from '../packages/db/index';
import { products, stockLevels, stockMovements } from '../packages/db/schema/inventory';

async function main() {
  console.log('Fetching supplies...');
  const supplies = await db.query.products.findMany({
    where: (p, { inArray }) =>
      inArray(p.kind, ['raw_material', 'consumable', 'merchandise', 'service']),
    columns: { id: true },
  });

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
