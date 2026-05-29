import { getStockLedger } from '@erp/services/inventory';
import { db } from '@erp/db';
import { products, stockLocations } from '@erp/db/schema/inventory';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@erp/ui/components/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@erp/ui/components/table';

export default async function StockLedgerPage({
  searchParams,
}: {
  searchParams: { productId?: string; locationId?: string; tenantId?: string };
}) {
  const { productId, locationId, tenantId = 'TENANT-001' } = searchParams;

  if (!productId || !locationId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Stock Ledger</h1>
        <p>Please select a product and location to view the stock ledger.</p>
      </div>
    );
  }

  const [product] = await db.select().from(products).where(eq(products.id, productId));
  const [location] = await db.select().from(stockLocations).where(eq(stockLocations.id, locationId));

  const result = await getStockLedger({
    tenantId,
    productId,
    locationId,
  });

  const movements = result.ok ? result.value : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold">Stock Ledger</h1>
          <p className="text-brand-muted">
            {product?.name?.id ?? productId} at {location?.name?.id ?? locationId}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Qty Delta</TableHead>
                <TableHead>UOM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-brand-muted">
                    No movements found for this product and location.
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{new Date(m.occurredAt).toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{m.reason.replace('_', ' ')}</TableCell>
                    <TableCell>
                      {m.referenceType && m.referenceId ? `${m.referenceType}: ${m.referenceId}` : '-'}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${Number.parseFloat(m.qtyDelta) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number.parseFloat(m.qtyDelta) > 0 ? '+' : ''}{m.qtyDelta}
                    </TableCell>
                    <TableCell>{m.uom}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
