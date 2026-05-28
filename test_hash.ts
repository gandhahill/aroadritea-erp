import { db } from '@erp/db';
import { authAccounts } from '@erp/db/schema/auth';

async function main() {
  const a = await db.select().from(authAccounts).limit(5);
  console.log(a.map(x => x.password));
  process.exit(0);
}
main();
