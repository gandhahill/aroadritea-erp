import { db } from '@erp/db';
import { journalEntries, journalLines } from '@erp/db/schema/accounting';
import { stockMovements } from '@erp/db/schema/inventory';
import { manualSalesClosings } from '@erp/db/schema/pos';
import { eq, sql } from 'drizzle-orm';

async function run() {
  const sales = await db.select().from(manualSalesClosings);
  console.log(
    'Manual Sales:',
    sales.map((s) => ({ id: s.id, status: s.status, journalId: s.journalEntryId })),
  );

  if (sales.length > 0) {
    const journals = await db
      .select()
      .from(journalEntries)
      .where(sql`reference_type = 'manual_sales_closing'`);
    console.log(
      'Journals:',
      journals.map((j) => ({ id: j.id, status: j.status, postedAt: j.postedAt })),
    );

    for (const j of journals) {
      const lines = await db
        .select()
        .from(journalLines)
        .where(eq(journalLines.journalEntryId, j.id));
      console.log(
        `Journal ${j.id} lines:`,
        lines.map((l) => ({ debit: l.debit, credit: l.credit, accountId: l.accountId })),
      );
    }
  }

  // HARD RESET LOGIC if needed
  if (process.argv.includes('--reset')) {
    console.log('HARD RESETTING MANUAL SALES DATA...');
    const deletedMovements = await db
      .delete(stockMovements)
      .where(sql`reference_type = 'manual_sales_closing'`)
      .returning({ id: stockMovements.id });
    const deletedJournals = await db
      .delete(journalEntries)
      .where(sql`reference_type = 'manual_sales_closing'`)
      .returning({ id: journalEntries.id });
    const deletedSales = await db
      .delete(manualSalesClosings)
      .returning({ id: manualSalesClosings.id });

    console.log('Deleted Sales:', deletedSales.length);
    console.log('Deleted Journals:', deletedJournals.length);
    console.log('Deleted Movements:', deletedMovements.length);
  }

  process.exit(0);
}
run().catch(console.error);
