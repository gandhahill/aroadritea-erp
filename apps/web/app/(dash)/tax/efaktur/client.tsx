'use client';

import { useState } from 'react';
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, toast } from '@erp/ui';
import { registerNsfpBlockAction, exportEFakturCsvAction } from './actions';

export default function EFakturClient({ initialBlocks, initialInvoices }: { initialBlocks: any[], initialInvoices: any[] }) {
  const [startNsfp, setStartNsfp] = useState('');
  const [endNsfp, setEndNsfp] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [exportPeriod, setExportPeriod] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );

  const handleRegister = async () => {
    if (!startNsfp || !endNsfp || !issueDate) {
      toast.error('Please fill in all NSFP block fields');
      return;
    }

    setLoading(true);
    const fd = new FormData();
    fd.append('startNsfp', startNsfp);
    fd.append('endNsfp', endNsfp);
    fd.append('issueDate', issueDate);

    const res = await registerNsfpBlockAction(fd);
    setLoading(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('NSFP block registered successfully');
      setStartNsfp('');
      setEndNsfp('');
      setIssueDate('');
    }
  };

  const handleExport = async () => {
    if (!exportPeriod) return;
    
    setLoading(true);
    const res = await exportEFakturCsvAction(exportPeriod);
    setLoading(false);

    if (res.error) {
      toast.error(res.error);
    } else if (res.csv) {
      // Download CSV
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `efaktur_${exportPeriod}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="font-semibold leading-none tracking-tight">Register NSFP Block</h3>
            <p className="text-sm text-muted-foreground">Input the NSFP range provided by DJP.</p>
          </div>
          <div className="p-6 pt-0 space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">Start NSFP</label>
              <Input value={startNsfp} onChange={(e: any) => setStartNsfp(e.target.value)} placeholder="e.g. 9002100000001" maxLength={16} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">End NSFP</label>
              <Input value={endNsfp} onChange={(e: any) => setEndNsfp(e.target.value)} placeholder="e.g. 9002100000100" maxLength={16} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">Issue Date</label>
              <Input type="date" value={issueDate} onChange={(e: any) => setIssueDate(e.target.value)} />
            </div>
            <Button onClick={handleRegister} disabled={loading} className="w-full">
              {loading ? 'Saving...' : 'Register Block'}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="font-semibold leading-none tracking-tight">Export e-Faktur CSV</h3>
            <p className="text-sm text-muted-foreground">Generate Coretax / e-Faktur CSV for a specific tax period.</p>
          </div>
          <div className="p-6 pt-0 space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium leading-none">Tax Period (YYYY-MM)</label>
              <Input type="month" value={exportPeriod} onChange={(e: any) => setExportPeriod(e.target.value)} />
            </div>
            <Button onClick={handleExport} disabled={loading || !exportPeriod} variant="secondary" className="w-full">
              Download CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="font-semibold leading-none tracking-tight">NSFP Blocks</h3>
          </div>
          <div className="p-6 pt-0">
            {initialBlocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No NSFP blocks registered.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Range</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialBlocks.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.startNsfp} - {b.endNsfp}</TableCell>
                      <TableCell className="font-mono text-xs">{b.lastUsedNsfp || '-'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${b.isActive ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80' : 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                          {b.isActive ? 'Active' : 'Exhausted'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="font-semibold leading-none tracking-tight">Recent Tax Invoices</h3>
          </div>
          <div className="p-6 pt-0">
            {initialInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tax invoices generated yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>NSFP</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">PPN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialInvoices.slice(0, 10).map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{new Date(inv.issueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                      <TableCell className="font-mono text-xs">{inv.nsfp}</TableCell>
                      <TableCell>{inv.customerName}</TableCell>
                      <TableCell className="text-right">{Number(inv.ppn).toLocaleString('id-ID')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
