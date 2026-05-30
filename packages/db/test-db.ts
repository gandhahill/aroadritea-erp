import { db, sql } from './index.js';

async function test() {
  const res = await db.execute(
    sql`SELECT id, name, tenant_id, kind, is_active FROM products LIMIT 5`,
  );
  console.log(Array.isArray(res) ? res : (res as any).rows);
  process.exit(0);
}
test();
