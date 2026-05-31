import postgres from 'postgres';

async function main() {
  const connectionString = 'postgresql://aroadritea:local_erp_s3cr3t_2026@103.93.162.50:5432/aroadritea_erp';
  const sql = postgres(connectionString);

  console.log('Deleting stock movements...');
  await sql`DELETE FROM stock_movements WHERE product_id IN (SELECT id FROM products WHERE kind IN ('raw_material', 'consumable', 'merchandise', 'service'))`;

  console.log('Deleting stock levels...');
  await sql`DELETE FROM stock_levels WHERE product_id IN (SELECT id FROM products WHERE kind IN ('raw_material', 'consumable', 'merchandise', 'service'))`;

  console.log('Deleting products...');
  const res = await sql`DELETE FROM products WHERE kind IN ('raw_material', 'consumable', 'merchandise', 'service') RETURNING id`;
  
  console.log(`Deleted ${res.length} products.`);

  console.log('Done!');
  process.exit(0);
}

main().catch(console.error);
