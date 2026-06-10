import { db as realDb } from '@erp/db';
import { users } from '@erp/db/schema/auth';
import { db } from '../src/../index.ts'; // wait, db is at @erp/db
import { getUserPermissions } from '../src/iam/permission-engine';

async function main() {
  const allUsers = await realDb.select().from(users).limit(5);
  for (const u of allUsers) {
    console.log(`\nUser: ${u.email} (${u.id})`);
    const perms = await getUserPermissions(u.id);
    console.log(JSON.stringify(perms, null, 2));
  }
  process.exit(0);
}

main().catch(console.error);
