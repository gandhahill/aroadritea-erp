import { db } from './index';
import { manualSalesClosings } from './schema/pos';
import { eq, desc } from 'drizzle-orm';
import { deleteManualSalesClosing } from '../services/src/pos/manual-sales';

async function run() {
  try {
    const closing = await db.select().from(manualSalesClosings).orderBy(desc(manualSalesClosings.createdAt)).limit(1).then(r => r[0]);
    if (!closing) {
      console.log('No closings found');
      process.exit(0);
    }
    console.log('Trying to delete closing:', closing.id);
    const ctx = {
      tenantId: closing.tenantId,
      userId: 'test',
      ipAddress: '127.0.0.1',
      userAgent: 'test'
    };
    const res = await deleteManualSalesClosing(closing.id, ctx as any);
    console.log('Result:', JSON.stringify(res, null, 2));
  } catch(e) {
    console.error('Crash:', e);
  }
  process.exit(0);
}
run();
