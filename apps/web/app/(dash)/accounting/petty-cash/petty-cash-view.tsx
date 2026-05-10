'use client';

import { useState, useMemo } from 'react';
import type { PettyCashAccountItem, PettyCashTransactionItem } from './actions';

function formatRupiah(amount: string): string {
  const n = Number(amount);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  accounts: PettyCashAccountItem[];
  transactions: Record<string, PettyCashTransactionItem[]>;
}

export function PettyCashView({ accounts, transactions }: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    accounts[0]?.id ?? null,
  );
  const [filterKind, setFilterKind] = useState<string | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId),
    [accounts, selectedAccountId],
  );

  const txList = useMemo(() => {
    const raw = selectedAccountId ? (transactions[selectedAccountId] ?? []) : [];
    if (!filterKind) return raw;
    return raw.filter((t) => t.kind === filterKind);
  }, [transactions, selectedAccountId, filterKind]);

  return (
    <div className="space-y-6">
      {/* Balance cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((acct) => {
          const pct = Number(acct.maxLimit) > 0
            ? (Number(acct.balance) / Number(acct.maxLimit)) * 100
            : 0;
          const isSelected = acct.id === selectedAccountId;

          return (
            <button
              key={acct.id}
              onClick={() => setSelectedAccountId(acct.id)}
              className={`surface-card interactive w-full p-5 text-left ${
                isSelected ? 'ring-2 ring-brand-red' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-brand-ink-2">
                  {acct.locationName}
                </span>
                {acct.isLowBalance && (
                  <span className="rounded-full bg-brand-clay-light px-2 py-0.5 text-xs font-medium text-brand-clay">
                    Saldo Rendah
                  </span>
                )}
              </div>
              <p className="mt-2 text-2xl font-bold text-brand-ink">
                {formatRupiah(acct.balance)}
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-brand-ink-3">
                  <span>Plafond: {formatRupiah(acct.maxLimit)}</span>
                  <span>{Math.round(pct)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-brand-cream-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      acct.isLowBalance ? 'bg-brand-clay' : 'bg-brand-jade'
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
              {acct.lastReplenishAt && (
                <p className="mt-2 text-xs text-brand-ink-3">
                  Isi ulang terakhir: {formatDate(acct.lastReplenishAt)}
                </p>
              )}
            </button>
          );
        })}

        {accounts.length === 0 && (
          <div className="surface-card col-span-full p-8 text-center">
            <p className="text-sm text-brand-ink-3">
              Belum ada kas kecil. Hubungi admin untuk membuat akun kas kecil.
            </p>
          </div>
        )}
      </div>

      {/* Transaction history */}
      {selectedAccount && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-ink">
              Riwayat Transaksi — {selectedAccount.locationName}
            </h2>
            <div className="flex gap-2">
              {(['all', 'topup', 'expense'] as const).map((kind) => {
                const isActive = kind === 'all' ? !filterKind : filterKind === kind;
                const label = kind === 'all' ? 'Semua' : kind === 'topup' ? 'Isi Ulang' : 'Pengeluaran';
                return (
                  <button
                    key={kind}
                    onClick={() => setFilterKind(kind === 'all' ? null : kind)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-red text-white'
                        : 'bg-brand-cream-2 text-brand-ink-2 hover:bg-brand-cream-3'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="surface-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-cream-2 bg-brand-cream/50">
                  <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Tanggal</th>
                  <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Jenis</th>
                  <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Keterangan</th>
                  <th className="px-4 py-3 text-right font-medium text-brand-ink-2">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-cream-2">
                {txList.map((tx) => (
                  <tr key={tx.id} className="hover:bg-brand-cream/50">
                    <td className="px-4 py-3 text-brand-ink-2">
                      {formatDate(tx.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          tx.kind === 'topup'
                            ? 'bg-brand-jade-light text-brand-jade'
                            : 'bg-brand-clay-light text-brand-clay'
                        }`}
                      >
                        {tx.kind === 'topup' ? 'Isi Ulang' : 'Pengeluaran'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-ink">{tx.description}</td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      tx.kind === 'topup' ? 'text-brand-jade' : 'text-brand-clay'
                    }`}>
                      {tx.kind === 'topup' ? '+' : '-'}{formatRupiah(tx.amount)}
                    </td>
                  </tr>
                ))}
                {txList.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-brand-ink-3">
                      Belum ada transaksi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
