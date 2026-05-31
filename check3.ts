import { db } from './index';
import { sql } from 'drizzle-orm';
async function run() {
  try {
    const res = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'tax_rates'`);
    console.log(res.map(r => r.column_name));
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
