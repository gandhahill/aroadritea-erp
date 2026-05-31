import { sql } from 'drizzle-orm';
import { db } from './index';

async function run() {
  try {
    const res = await db.execute(sql`SELECT number, sales_date, status, journal_entry_id FROM manual_sales_closings ORDER BY created_at DESC LIMIT 5`);
    console.log("DB RESULT:", res);
    
    // Also see how Javascript parses the date by fetching it with drizzle
    const closings = await db.query.manualSalesClosings.findMany({
      orderBy: (c, { desc }) => [desc(c.createdAt)],
      limit: 5,
    });
    console.log("ORM RESULT:");
    for (const c of closings) {
      console.log(`- ${c.number}: typeof salesDate = ${typeof c.salesDate}, value =`, c.salesDate, `| toISOString =`, (c.salesDate as any)?.toISOString?.());
    }
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
