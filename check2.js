import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    const res = await sql`SELECT sales_date FROM manual_sales_closings LIMIT 1`;
    console.log("Result type:", typeof res[0].sales_date, "Value:", res[0].sales_date);
  } catch(e) { console.log("⚠️ " + e.message); }
  
  process.exit(0);
}
run();
