import { db } from '@erp/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Deleting non-sellable products...');
  
  // Get non-sellable products
  const rows = await db.execute(sql`SELECT id FROM products WHERE is_sellable = false`);
  const ids = rows.map((r: any) => r.id);
  
  if (ids.length === 0) {
    console.log('No non-sellable products found.');
    process.exit(0);
  }

  console.log(`Found ${ids.length} products to delete. Deleting dependencies...`);
  
  const idsStr = ids.map((id: string) => `'${id}'`).join(',');

  try {
    // Attempt to delete dependencies if they exist
    await db.execute(sql`DELETE FROM stock_opname_lines WHERE product_id IN (${sql.raw(idsStr)})`);
    await db.execute(sql`DELETE FROM stock_movements WHERE product_id IN (${sql.raw(idsStr)})`);
    await db.execute(sql`DELETE FROM stock_levels WHERE product_id IN (${sql.raw(idsStr)})`);
    await db.execute(sql`DELETE FROM product_variants WHERE product_id IN (${sql.raw(idsStr)})`);
    await db.execute(sql`DELETE FROM recipe_ingredients WHERE product_id IN (${sql.raw(idsStr)})`);
    await db.execute(sql`DELETE FROM recipes WHERE product_id IN (${sql.raw(idsStr)})`);
    
    // Finally delete the products
    await db.execute(sql`DELETE FROM products WHERE id IN (${sql.raw(idsStr)})`);
    
    console.log('Successfully deleted non-sellable products!');
  } catch (err) {
    console.error('Error deleting products:', err);
  }
  
  process.exit(0);
}

main().catch(console.error);
