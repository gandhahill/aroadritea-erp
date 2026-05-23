'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { importBankStatement } from '../actions';
import { Input, TableBody, Select } from "@erp/ui";

interface MasterData {
  bankAccounts: { id: string; name: string; number: string }[];
  locations: { id: string; code: string; name: { id: string; en: string; zh: string } }[];
}

interface Labels {
  back: string;
  file: string;
  location: string;
  selectLocation: string;
  submit: string;
  submitting: string;
  success: string;
  failed: string;
  missingMasterData: string;
  templateHint: string;
  downloadTemplate: string;
  pdfHint: string;
  orManual: string;
  manualTitle: string;
  manualSubtitle: string;
  addLine: string;
  removeLine: string;
  transactionDate: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
  runningBalance: string;
  noLines: string;
  select: string;
  openingBalance: string;
  closingBalance: string;
  csvUpload: string;
}

interface Props extends MasterData {
  labels: Labels;
  commonLabels: { bankAccount: string };
}

interface LineDraft {
  transactionDate: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
  runningBalance: string;
}

export function ImportClient({ bankAccounts, locations, labels, commonLabels }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id || '');
  const [locationId, setLocationId] = useState(locations[0]?.id || '');
  const [statementDate, setStatementDate] = useState(new Date().toISOString().substring(0, 10));
  const [openingBalance, setOpeningBalance] = useState('0');
  const [closingBalance, setClosingBalance] = useState('0');
  const [notes, setNotes] = useState('');

  const [mode, setMode] = useState<'csv' | 'manual'>('csv');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  if (bankAccounts.length === 0 || locations.length === 0) {
    return (
      <div className="rounded-md bg-brand-red/10 p-4 text-brand-red">
        {labels.missingMasterData}
      </div>
    );
  }

  const downloadTemplate = () => {
    const header = 'Date,Description,Debit,Credit,Balance\n';
    const sampleRow =
      '2025-12-01,SALDO AWAL,0,0,46284627\n2025-12-09,TRANSFER KE PT BIDAKARA,3000000,0,43284627\n';
    const blob = new Blob([header + sampleRow], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bank_statement_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').map((row) => row.split(','));
      // skip header
      const parsedLines: LineDraft[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row && row.length >= 5) {
          const date = row[0]?.trim();
          if (!date) continue;
          parsedLines.push({
            transactionDate: date,
            description: row[1]?.trim() || '',
            debitAmount: row[2]?.trim() || '0',
            creditAmount: row[3]?.trim() || '0',
            runningBalance: row[4]?.trim() || '0',
          });
        }
      }
      setLines(parsedLines);
    };
    reader.readAsText(file);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      parseCsv(file);
    }
  };

  const onSubmit = () => {
    setError(null);
    if (!bankAccountId || !locationId || !statementDate) {
      setError(labels.failed);
      return;
    }

    startTransition(async () => {
      const res = await importBankStatement({
        bankAccountId,
        locationId,
        statementDate,
        openingBalance,
        closingBalance,
        notes,
        lines,
      });
      if (res.success) {
        router.push(`/accounting/bank-recon/${res.id}`);
      } else {
        setError(res.error || labels.failed);
      }
    });
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        transactionDate: statementDate,
        description: '',
        debitAmount: '0',
        creditAmount: '0',
        runningBalance: '0',
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    const newLines = [...lines];
    const current = newLines[index] as LineDraft;
    newLines[index] = {
      ...current,
      transactionDate: patch.transactionDate ?? current.transactionDate,
      description: patch.description ?? current.description,
      debitAmount: patch.debitAmount ?? current.debitAmount,
      creditAmount: patch.creditAmount ?? current.creditAmount,
      runningBalance: patch.runningBalance ?? current.runningBalance,
    };
    setLines(newLines);
  };

  return (
    <div className="space-y-8">
      {/* Header Form */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
            {commonLabels.bankAccount}
          </label>
          <Select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          >
            <option value="" disabled>
              {labels.select}
            </option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} - {b.number}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
            {labels.location}
          </label>
          <Select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          >
            <option value="" disabled>
              {labels.selectLocation}
            </option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} - {l.name.id}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
            {labels.transactionDate}
          </label>
          <Input
            type="date"
            value={statementDate}
            onChange={(e) => setStatementDate(e.target.value)}
            className="w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
            {labels.openingBalance}
          </label>
          <Input
            type="number"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            className="w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
            {labels.closingBalance}
          </label>
          <Input
            type="number"
            value={closingBalance}
            onChange={(e) => setClosingBalance(e.target.value)}
            className="w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink"
          />
        </div>
      </div>

      {/* Mode Switch */}
      <div className="flex gap-4 border-b border-brand-cream-3 pb-4">
        <button
          className={`pb-2 text-sm font-semibold transition-colors ${mode === 'csv' ? 'border-b-2 border-brand-red text-brand-red' : 'text-brand-ink-3 hover:text-brand-ink'}`}
          onClick={() => setMode('csv')}
        >
          {labels.csvUpload}
        </button>
        <button
          className={`pb-2 text-sm font-semibold transition-colors ${mode === 'manual' ? 'border-b-2 border-brand-red text-brand-red' : 'text-brand-ink-3 hover:text-brand-ink'}`}
          onClick={() => setMode('manual')}
        >
          {labels.manualTitle}
        </button>
      </div>

      {/* Mode Content */}
      <div className="rounded-lg border border-brand-cream-3 bg-card p-6">
        {mode === 'csv' && (
          <div className="space-y-4">
            <p className="text-sm text-brand-ink-3">{labels.templateHint}</p>
            <p className="text-sm text-brand-ink-3">{labels.pdfHint}</p>
            <div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-sm font-medium text-brand-red hover:underline"
              >
                {labels.downloadTemplate}
              </button>
            </div>
            <div>
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="text-sm" />
            </div>
          </div>
        )}

        {mode === 'manual' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-brand-ink-3">{labels.manualSubtitle}</p>
              <button
                type="button"
                onClick={addLine}
                className="rounded-md bg-brand-cream-3 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-cream-2"
              >
                {labels.addLine}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lines Preview/Edit */}
      {(lines.length > 0 || mode === 'manual') && (
        <div className="overflow-x-auto rounded-lg border border-brand-cream-3 bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-cream-2 text-xs uppercase tracking-widest text-brand-ink-3">
              <tr>
                <th className="px-3 py-3 w-40">{labels.transactionDate}</th>
                <th className="px-3 py-3">{labels.description}</th>
                <th className="px-3 py-3 w-32 text-right">{labels.debitAmount}</th>
                <th className="px-3 py-3 w-32 text-right">{labels.creditAmount}</th>
                <th className="px-3 py-3 w-40 text-right">{labels.runningBalance}</th>
                <th className="px-3 py-3 w-16"></th>
              </tr>
            </thead>
            <TableBody className="divide-y divide-brand-cream-3">
              {lines.map((line, i) => (
                <tr key={i} className="align-top">
                  <td className="px-3 py-2">
                    <Input
                      type="date"
                      value={line.transactionDate}
                      onChange={(e) => updateLine(i, { transactionDate: e.target.value })}
                      className="w-full rounded border border-brand-cream-3 bg-transparent px-2 py-1 focus:border-brand-red focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(i, { description: e.target.value })}
                      className="w-full rounded border border-brand-cream-3 bg-transparent px-2 py-1 focus:border-brand-red focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      value={line.debitAmount}
                      onChange={(e) => updateLine(i, { debitAmount: e.target.value })}
                      className="w-full rounded border border-brand-cream-3 bg-transparent px-2 py-1 text-right focus:border-brand-red focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      value={line.creditAmount}
                      onChange={(e) => updateLine(i, { creditAmount: e.target.value })}
                      className="w-full rounded border border-brand-cream-3 bg-transparent px-2 py-1 text-right focus:border-brand-red focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      value={line.runningBalance}
                      onChange={(e) => updateLine(i, { runningBalance: e.target.value })}
                      className="w-full rounded border border-brand-cream-3 bg-transparent px-2 py-1 text-right focus:border-brand-red focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => removeLine(i)}
                      className="text-brand-red hover:underline text-xs"
                    >
                      {labels.removeLine}
                    </button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-brand-ink-3">
                    {labels.noLines}
                  </td>
                </tr>
              )}
            </TableBody>
          </table>
        </div>
      )}

      {error && <div className="text-sm font-medium text-brand-red">{error}</div>}

      <div className="flex justify-end pt-4">
        <button
          onClick={onSubmit}
          disabled={isPending || lines.length === 0}
          className="rounded-md bg-brand-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
        >
          {isPending ? labels.submitting : labels.submit}
        </button>
      </div>
    </div>
  );
}
