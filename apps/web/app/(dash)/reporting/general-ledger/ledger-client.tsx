'use client';

import { Button, Input, Select, Table, TableBody, TableCell, TableHead } from '@erp/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { ExportXlsxButton } from '../export-button';

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

function fmt(amount: string | bigint): string {
  const big = typeof amount === 'string' ? BigInt(amount) : amount;
  if (big < 0n) return `(${IDR.format(Number(-big))})`;
  return IDR.format(Number(big));
}

interface Props {
  from: string;
  to: string;
  locationId: string;
  accountId: string;
  locationOptions: Array<{ value: string; label: string }>;
  accountOptions: Array<{ value: string; label: string; code: string }>;
  data: {
    accountId: string;
    accountCode: string;
    accountName: Record<string, string>;
    accountType: string;
    normalBalance: string;
    startDate: string;
    endDate: string;
    locationId: string | null;
    beginningBalance: bigint;
    lines: Array<{
      journalEntryId: string;
      journalNumber: string;
      postingDate: string;
      description: string;
      debit: bigint;
      credit: bigint;
      balance: bigint;
    }>;
    endingBalance: bigint;
    comparativeBeginningBalance: bigint;
    comparativeEndingBalance: bigint;
  } | null;
  error: string | null;
}

export function LedgerClient(props: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(search.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`?${next.toString()}`));
  }

  function exportCsv() {
    if (!props.data) return;
    const rows: string[][] = [];
    rows.push(['Buku Besar (General Ledger)', '', '', '', '', '']);
    const name = props.data.accountName?.id || props.data.accountName?.en || 'Account';
    rows.push([`Akun: ${props.data.accountCode} - ${name}`, '', '', '', '', '']);
    rows.push([`Periode: ${props.from} s/d ${props.to}`, '', '', '', '', '']);
    rows.push(['', '', '', '', '', '']);
    rows.push(['Tanggal', 'No. Jurnal', 'Keterangan', 'Debit', 'Kredit', 'Saldo']);
    
    rows.push([props.from, '-', 'Saldo Awal', '', '', props.data.beginningBalance.toString()]);
    for (const m of props.data.lines) {
      rows.push([
        m.postingDate,
        m.journalNumber,
        m.description,
        m.debit.toString(),
        m.credit.toString(),
        m.balance.toString(),
      ]);
    }
    rows.push([props.to, '-', 'Saldo Akhir', '', '', props.data.endingBalance.toString()]);
    
    const csv = rows
      .map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `general-ledger-${props.data.accountCode}-${props.from}-to-${props.to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="space-y-4">
      {props.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {props.error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-cream-3 bg-card p-3">
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">Akun (Account)</span>
          <Select
            value={props.accountId}
            onChange={(e) => updateParam('accountId', e.target.value)}
            className="w-64"
          >
            <option value="">-- Pilih Akun --</option>
            {props.accountOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.code} - {opt.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">Dari (From)</span>
          <Input
            type="date"
            defaultValue={props.from}
            onBlur={(e) => updateParam('from', e.target.value)}
            className="w-44"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">Sampai (To)</span>
          <Input
            type="date"
            defaultValue={props.to}
            onBlur={(e) => updateParam('to', e.target.value)}
            className="w-44"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">Lokasi (Location)</span>
          <Select
            value={props.locationId}
            onChange={(e) => updateParam('locationId', e.target.value)}
            className="w-56"
          >
            <option value="">Semua Lokasi</option>
            {props.locationOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </label>
        <Button variant="primary" size="md" onClick={() => router.refresh()} disabled={pending}>
          Filter
        </Button>
        <ExportXlsxButton onExport={exportCsv} disabled={!props.data} label="Ekspor CSV" />
      </div>

      {props.data ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
             <div className="rounded-xl border border-brand-cream-3 bg-card p-4">
               <h3 className="text-sm font-semibold text-brand-ink mb-3 border-b border-brand-cream-3 pb-2">Periode Saat Ini</h3>
               <div className="flex justify-between py-1 text-sm">
                 <span className="text-brand-ink-3">Saldo Awal</span>
                 <span className="font-semibold text-brand-ink">{fmt(props.data.beginningBalance)}</span>
               </div>
               <div className="flex justify-between py-1 text-sm font-semibold">
                 <span className="text-brand-ink">Saldo Akhir</span>
                 <span className="text-brand-ink">{fmt(props.data.endingBalance)}</span>
               </div>
             </div>
             
             <div className="rounded-xl border border-brand-cream-3 bg-card p-4">
               <h3 className="text-sm font-semibold text-brand-ink mb-3 border-b border-brand-cream-3 pb-2">Periode Perbandingan (Tahun/Bulan Lalu)</h3>
               <div className="flex justify-between py-1 text-sm">
                 <span className="text-brand-ink-3">Saldo Awal</span>
                 <span className="font-semibold text-brand-ink">{fmt(props.data.comparativeBeginningBalance)}</span>
               </div>
               <div className="flex justify-between py-1 text-sm font-semibold">
                 <span className="text-brand-ink">Saldo Akhir</span>
                 <span className="text-brand-ink">{fmt(props.data.comparativeEndingBalance)}</span>
               </div>
             </div>
          </div>
          
          <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
            <Table>
              <thead className="bg-brand-cream-2/20 text-left text-[11px] uppercase text-brand-ink-3">
                <tr>
                  <TableHead className="px-3 py-2">Tanggal</TableHead>
                  <TableHead className="px-3 py-2">No. Jurnal</TableHead>
                  <TableHead className="px-3 py-2">Keterangan</TableHead>
                  <TableHead className="px-3 py-2 text-right">Debit</TableHead>
                  <TableHead className="px-3 py-2 text-right">Kredit</TableHead>
                  <TableHead className="px-3 py-2 text-right">Saldo</TableHead>
                </tr>
              </thead>
              <TableBody>
                <tr className="border-t border-brand-cream-3 text-xs bg-brand-cream-1/30">
                  <TableCell className="px-3 py-3 font-semibold text-brand-ink-2" colSpan={5}>Saldo Awal (Beginning Balance)</TableCell>
                  <TableCell className="px-3 py-3 text-right font-semibold text-brand-ink">{fmt(props.data.beginningBalance)}</TableCell>
                </tr>
                {props.data.lines.map((m, idx) => (
                  <tr
                    key={m.journalEntryId + idx}
                    className="border-t border-brand-cream-3 text-xs hover:bg-brand-cream-1/50"
                  >
                    <TableCell className="px-3 py-2 text-brand-ink-2">{m.postingDate}</TableCell>
                    <TableCell className="px-3 py-2 font-mono text-brand-ink-2">
                      <a href={`/accounting/journals/${m.journalEntryId}`} className="hover:underline text-brand-red">{m.journalNumber}</a>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-brand-ink-2">
                      {m.description}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono text-brand-ink">
                      {m.debit > 0n ? fmt(m.debit) : '-'}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono text-brand-ink">
                      {m.credit > 0n ? fmt(m.credit) : '-'}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono font-medium text-brand-ink">
                      {fmt(m.balance)}
                    </TableCell>
                  </tr>
                ))}
                {props.data.lines.length === 0 && (
                  <tr>
                     <TableCell colSpan={6} className="px-3 py-8 text-center text-brand-ink-3">Tidak ada transaksi pada periode ini.</TableCell>
                  </tr>
                )}
                <tr className="border-t border-brand-cream-3 text-xs bg-brand-cream-1/30">
                  <TableCell className="px-3 py-3 font-semibold text-brand-ink-2" colSpan={5}>Saldo Akhir (Ending Balance)</TableCell>
                  <TableCell className="px-3 py-3 text-right font-semibold text-brand-ink">{fmt(props.data.endingBalance)}</TableCell>
                </tr>
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
