'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, toast } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { calculateSptMasaAction, fetchVatLedgerAction, exportSptMasaAction, type PeriodOption } from './actions';
import type { SptMasaSummary, VatLedgerRow } from '@erp/services/tax';

export default function SptMasaClient({ initialPeriods }: { initialPeriods: PeriodOption[] }) {
  const t = useTranslations('tax.spt');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialPeriods[0]?.id ?? '');
  const [summary, setSummary] = useState<SptMasaSummary | null>(null);
  const [outLedger, setOutLedger] = useState<VatLedgerRow[]>([]);
  const [inLedger, setInLedger] = useState<VatLedgerRow[]>([]);
  const [activeTab, setActiveTab] = useState<'out' | 'in'>('out');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedPeriod) return;
    startTransition(async () => {
      const resSum = await calculateSptMasaAction(selectedPeriod);
      if (resSum.error) {
        toast.error(resSum.error);
        return;
      }
      setSummary(resSum.summary ?? null);

      const resOut = await fetchVatLedgerAction(selectedPeriod, 'out');
      if (resOut.error) toast.error(resOut.error);
      else setOutLedger(resOut.rows ?? []);

      const resIn = await fetchVatLedgerAction(selectedPeriod, 'in');
      if (resIn.error) toast.error(resIn.error);
      else setInLedger(resIn.rows ?? []);
    });
  }, [selectedPeriod]);

  const handleExport = async () => {
    if (!selectedPeriod) return;
    const res = await exportSptMasaAction(selectedPeriod);
    if (res.error) {
      toast.error(res.error);
    } else if (res.csv) {
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spt-masa-${selectedPeriod}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const activeLedger = activeTab === 'out' ? outLedger : inLedger;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="w-full sm:w-64">
          <Select
            value={selectedPeriod}
            onChange={(e: any) => setSelectedPeriod(e.target.value)}
          >
            {initialPeriods.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.status})
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={handleExport} disabled={isPending || !summary}>
          {t('exportCsv')}
        </Button>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">{t('loading')}</p>}

      {!isPending && summary && (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
              <h3 className="text-sm font-medium leading-none mb-2">{t('totalPpnOut')}</h3>
              <p className="text-2xl font-bold">{Number(summary.totalPpnOut).toLocaleString('id-ID')}</p>
            </div>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
              <h3 className="text-sm font-medium leading-none mb-2">{t('totalPpnIn')}</h3>
              <p className="text-2xl font-bold">{Number(summary.totalPpnIn).toLocaleString('id-ID')}</p>
            </div>
            <div className={`rounded-lg border shadow-sm p-6 ${summary.netPayable > 0n ? 'bg-red-50 text-red-900 border-red-200' : 'bg-green-50 text-green-900 border-green-200'}`}>
              <h3 className="text-sm font-medium leading-none mb-2">{t('netLabel')}</h3>
              <p className="text-2xl font-bold">{Number(summary.netPayable).toLocaleString('id-ID')}</p>
              <p className="text-xs mt-1 opacity-80">{summary.netPayable > 0n ? t('payable') : summary.netPayable < 0n ? t('overpaid') : t('nihil')}</p>
            </div>
          </div>

          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex border-b">
              <button
                className={`px-4 py-3 text-sm font-medium ${activeTab === 'out' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('out')}
              >
                {t('taxOut')} ({outLedger.length})
              </button>
              <button
                className={`px-4 py-3 text-sm font-medium ${activeTab === 'in' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('in')}
              >
                {t('taxIn')} ({inLedger.length})
              </button>
            </div>
            <div className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('reference')}</TableHead>
                    <TableHead>{t('partner')}</TableHead>
                    <TableHead>{t('nsfp')}</TableHead>
                    <TableHead className="text-right">{t('dpp')}</TableHead>
                    <TableHead className="text-right">{t('ppn')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeLedger.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        {t('noTransactions')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeLedger.map((row) => (
                      <TableRow key={row.journalLineId}>
                        <TableCell>{new Date(row.postingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                        <TableCell>
                          <div className="font-medium">{row.referenceId || '-'}</div>
                          <div className="text-xs text-muted-foreground">{row.description}</div>
                        </TableCell>
                        <TableCell>{row.partnerName}</TableCell>
                        <TableCell className="font-mono text-xs">{row.nsfp || '-'}</TableCell>
                        <TableCell className="text-right">{Number(row.dpp).toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right">{Number(row.ppn).toLocaleString('id-ID')}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
