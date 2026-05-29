'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, toast } from '@erp/ui';
import { fetchBuktiPotongAction, exportBuktiPotongCsvAction } from './actions';
import type { BupotSummaryRow } from '@erp/services/tax';

export default function BupotClient() {
  const [period, setPeriod] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const [rows, setRows] = useState<BupotSummaryRow[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!period) return;
    startTransition(async () => {
      const res = await fetchBuktiPotongAction(period);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setRows(res.rows ?? []);
    });
  }, [period]);

  const handleExport = async () => {
    if (!period) return;
    const res = await exportBuktiPotongCsvAction(period);
    if (res.error) {
      toast.error(res.error);
    } else if (res.csv) {
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bupot-${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="w-full sm:w-64 grid gap-2">
          <label className="text-sm font-medium leading-none">Tax Period (YYYY-MM)</label>
          <Input type="month" value={period} onChange={(e: any) => setPeriod(e.target.value)} />
        </div>
        <Button onClick={handleExport} disabled={isPending || rows.length === 0} variant="secondary">
          Export CSV
        </Button>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6 border-b">
          <h3 className="font-semibold leading-none tracking-tight">Daftar Bukti Potong</h3>
        </div>
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Bupot</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Tax Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">DPP</TableHead>
                <TableHead className="text-right">Tax Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No withholding taxes generated for this period.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.bupotNumber}</TableCell>
                    <TableCell>{new Date(row.issueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                    <TableCell>{row.vendorName}</TableCell>
                    <TableCell>{row.taxCode}</TableCell>
                    <TableCell>{row.incomeType}</TableCell>
                    <TableCell className="text-right">{Number(row.dpp).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right">{Number(row.taxAmount).toLocaleString('id-ID')}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
