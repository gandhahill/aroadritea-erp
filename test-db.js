const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query("SELECT id, kind, is_active, name FROM products LIMIT 5");
  console.log("Products:");
  console.log(res.rows);
  
  console.log("DEEPSEEK_API_KEY present:", !!process.env.DEEPSEEK_API_KEY);
  console.log("AI_ASSISTANT_ENABLED:", process.env.AI_ASSISTANT_ENABLED);
  process.exit(0);
}
main().catch(console.error);
