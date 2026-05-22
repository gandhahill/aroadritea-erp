'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  type BankAccountActionResult,
  type BankAccountDraft,
  type BankAccountItem,
  deleteBankAccount,
  saveBankAccount,
} from './actions';

interface Labels {
  add: string;
  edit: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  linkedCoa: string;
  selectCoa: string;
  status: string;
  save: string;
  saving: string;
  empty: string;
  delete: string;
  deleteConfirm: string;
  active: string;
  inactive: string;
}

interface CoaAccount {
  id: string;
  code: string;
  name: { id: string; en: string; zh: string };
}

interface Props {
  accounts: BankAccountItem[];
  coaAccounts: CoaAccount[];
  labels: Labels;
}

const emptyAccount: BankAccountDraft = {
  id: null,
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  accountId: '',
  isActive: true,
};

export function BankAccountsClient({ accounts, coaAccounts, labels }: Props) {
  const [rows, setRows] = useState<BankAccountDraft[]>(accounts);
  const [result, setResult] = useState<BankAccountActionResult | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedRows = useMemo(
    () => rows.map((row, index) => ({ row, key: row.id ?? `new-${index}` })),
    [rows]
  );

  function updateRow(index: number, patch: Partial<BankAccountDraft>) {
    setRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
  }

  function addRow() {
    setRows((prev) => [{ ...emptyAccount }, ...prev]);
  }

  function submitRow(row: BankAccountDraft) {
    const optimisticId = row.id ?? 'new';
    setPendingId(optimisticId);
    setResult(null);
    startTransition(async () => {
      const response = await saveBankAccount(row);
      setResult(response);
      setPendingId(null);
      if (response.success && !row.id) {
        setRows((prev) =>
          prev.map((item) =>
            item === row ? { ...item, id: response.id } : item
          )
        );
      }
    });
  }

  function removeRow(row: BankAccountDraft) {
    if (!row.id) {
      setRows((prev) => prev.filter((item) => item !== row));
      return;
    }
    if (!confirm(labels.deleteConfirm)) return;
    setPendingId(row.id);
    setResult(null);
    startTransition(async () => {
      const response = await deleteBankAccount({ id: row.id ?? '' });
      setResult(response);
      setPendingId(null);
      if (response.success) {
        setRows((prev) => prev.filter((item) => item.id !== row.id));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={addRow}
          className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
        >
          {labels.add}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            result.success ? 'bg-brand-jade/10 text-brand-jade' : 'bg-brand-red/10 text-brand-red'
          }`}
        >
          {result.success ? labels.save + ' OK' : result.error}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-brand-cream-3 bg-card p-12 text-center text-brand-ink-3">
          {labels.empty}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brand-cream-3 bg-card">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-brand-cream-2 text-left text-xs uppercase tracking-widest text-brand-ink-3">
              <tr>
                <th className="px-3 py-3">{labels.bankName}</th>
                <th className="px-3 py-3">{labels.accountNumber}</th>
                <th className="px-3 py-3">{labels.accountHolder}</th>
                <th className="px-3 py-3">{labels.linkedCoa}</th>
                <th className="px-3 py-3">{labels.status}</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3">
              {sortedRows.map(({ row, key }, index) => (
                <tr key={key} className="align-top">
                  <td className="px-3 py-3">
                    <input
                      value={row.bankName}
                      onChange={(e) => updateRow(index, { bankName: e.target.value })}
                      placeholder="e.g. BCA, Mandiri"
                      className="h-9 w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      value={row.accountNumber}
                      onChange={(e) => updateRow(index, { accountNumber: e.target.value })}
                      className="h-9 w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      value={row.accountHolder}
                      onChange={(e) => updateRow(index, { accountHolder: e.target.value })}
                      className="h-9 w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.accountId}
                      onChange={(e) => updateRow(index, { accountId: e.target.value })}
                      className="h-9 w-full max-w-[250px] rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                    >
                      <option value="" disabled>
                        {labels.selectCoa}
                      </option>
                      {coaAccounts.map((coa) => (
                        <option key={coa.id} value={coa.id}>
                          {coa.code} - {coa.name.id}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.isActive ? 'true' : 'false'}
                      onChange={(e) => updateRow(index, { isActive: e.target.value === 'true' })}
                      className="h-9 w-28 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                    >
                      <option value="true">{labels.active}</option>
                      <option value="false">{labels.inactive}</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => submitRow(row)}
                        disabled={isPending && pendingId === (row.id ?? 'new')}
                        className="rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPending && pendingId === (row.id ?? 'new')
                          ? labels.saving
                          : labels.save}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(row)}
                        disabled={isPending && pendingId === (row.id ?? 'new')}
                        className="rounded-md border border-brand-cream-3 px-3 py-2 text-xs font-semibold text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {labels.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
