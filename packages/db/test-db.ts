import { db, sql } from './index.js';

async function test() {
  const res = await db.execute(sql`SELECT id, name, tenant_id, kind, is_active FROM products LIMIT 5`);
  console.log(res.rows);
  process.exit(0);
}
test();
