'use client';

import { useMemo, useState, useTransition } from 'react';
import type {
  PettyCashAccountItem,
  PettyCashEmptyLocation,
  PettyCashTransactionItem,
} from './actions';
import {
  createAccountAction,
  depositToBankAction,
  expenseAction,
  replenishAction,
} from './actions';
import { useRouter } from 'next/navigation';

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
  emptyLocations: PettyCashEmptyLocation[];
}

export function PettyCashView({ accounts, transactions, emptyLocations }: Props) {
  const router = useRouter();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    accounts[0]?.id ?? null,
  );
  const [filterKind, setFilterKind] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<string | null>(null); // locationId in progress
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Per-outlet form state — each outlet has its own plafond + modal
   * pembukaan since allocation differs by store size (e.g., outlet
   * besar Rp 1.000.000, outlet kecil Rp 300.000). */
  const [forms, setForms] = useState<
    Record<string, { maxLimit: string; openingBalance: string }>
  >(() => {
    const init: Record<string, { maxLimit: string; openingBalance: string }> = {};
    for (const loc of emptyLocations) {
      init[loc.id] = { maxLimit: '500000', openingBalance: '500000' };
    }
    return init;
  });

  function setForm(locationId: string, field: 'maxLimit' | 'openingBalance', value: string) {
    setForms((prev) => ({
      ...prev,
      [locationId]: {
        ...(prev[locationId] ?? { maxLimit: '500000', openingBalance: '500000' }),
        [field]: value.replace(/\D/g, ''),
      },
    }));
  }

  type ActionKind = 'topup' | 'expense' | 'deposit_to_bank' | null;
  const [actionModal, setActionModal] = useState<ActionKind>(null);
  const [actionAmount, setActionAmount] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, startActionTransition] = useTransition();

  function openActionModal(kind: ActionKind) {
    setActionModal(kind);
    setActionAmount('');
    setActionNote('');
    setActionError(null);
  }

  function submitAction() {
    if (!selectedAccountId || !actionModal) return;
    const acct = accounts.find((a) => a.id === selectedAccountId);
    if (!acct) return;
    const amountNum = Number.parseInt(actionAmount.replace(/\D/g, ''), 10) || 0;
    if (amountNum <= 0) {
      setActionError('Nominal wajib diisi.');
      return;
    }
    if (actionModal !== 'topup' && amountNum > Number(acct.balance)) {
      setActionError('Nominal melebihi saldo kas kecil.');
      return;
    }
    setActionError(null);
    startActionTransition(async () => {
      try {
        if (actionModal === 'topup') {
          await replenishAction(acct.locationId, amountNum, actionNote || 'Isi ulang kas kecil');
        } else if (actionModal === 'expense') {
          if (!actionNote.trim()) {
            setActionError('Keterangan pengeluaran wajib diisi.');
            return;
          }
          await expenseAction(acct.locationId, amountNum, actionNote);
        } else if (actionModal === 'deposit_to_bank') {
          await depositToBankAction(
            acct.locationId,
            amountNum,
            actionNote || 'Setor kas kecil ke bank',
          );
        }
        setActionModal(null);
        router.refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Gagal mencatat transaksi.');
      }
    });
  }

  const handleCreate = async (locationId: string) => {
    try {
      setIsCreating(locationId);
      setErrorMessage(null);
      const form = forms[locationId] ?? { maxLimit: '500000', openingBalance: '500000' };
      const limitNum = Number.parseInt(form.maxLimit, 10) || 0;
      const openNum = Number.parseInt(form.openingBalance, 10) || 0;
      if (limitNum <= 0) {
        setErrorMessage('Plafond kas kecil wajib diisi.');
        return;
      }
      if (openNum > limitNum) {
        setErrorMessage('Modal pembukaan tidak boleh melebihi plafond.');
        return;
      }
      await createAccountAction(locationId, limitNum, openNum);
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal membuat akun kas kecil');
    } finally {
      setIsCreating(null);
    }
  };

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
      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}
      {/* Balance cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((acct) => {
          const pct =
            Number(acct.maxLimit) > 0 ? (Number(acct.balance) / Number(acct.maxLimit)) * 100 : 0;
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
                <span className="text-sm font-medium text-brand-ink-2">{acct.locationName}</span>
                {acct.isLowBalance && (
                  <span className="rounded-full bg-brand-clay-light px-2 py-0.5 text-xs font-medium text-brand-clay">
                    Saldo Rendah
                  </span>
                )}
              </div>
              <p className="mt-2 text-2xl font-bold text-brand-ink">{formatRupiah(acct.balance)}</p>
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

        {/* Per-outlet "Buka kas kecil" cards for every outlet that
            doesn't yet have an account. Plafond + opening balance are
            independently editable per outlet — outlet besar bisa
            Rp 1.000.000, outlet kecil Rp 300.000, dll. */}
        {emptyLocations.map((loc) => {
          const form = forms[loc.id] ?? { maxLimit: '500000', openingBalance: '500000' };
          const pending = isCreating === loc.id;
          return (
            <div key={loc.id} className="surface-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-brand-ink">{loc.name}</h3>
                <span className="rounded-full bg-brand-cream-2 px-2 py-0.5 text-[11px] font-medium text-brand-ink-3">
                  Belum dibuka
                </span>
              </div>
              <p className="mb-3 text-xs text-brand-ink-3">
                Saat dibuka, sistem otomatis mencatat jurnal <b>DR Kas Kecil · CR Kas</b>.
              </p>
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wider text-brand-ink-2">
                  Plafond kas kecil
                </span>
                <div className="mt-1 flex items-center rounded-md border border-brand-cream-3 bg-card px-3 py-1.5">
                  <span className="text-sm text-brand-ink-3">Rp</span>
                  <input
                    inputMode="numeric"
                    value={form.maxLimit}
                    onChange={(e) => setForm(loc.id, 'maxLimit', e.target.value)}
                    placeholder="500000"
                    className="ml-2 flex-1 bg-transparent text-sm text-brand-ink focus:outline-none"
                  />
                </div>
              </label>
              <label className="mt-3 block">
                <span className="text-[11px] font-medium uppercase tracking-wider text-brand-ink-2">
                  Modal pembukaan
                </span>
                <div className="mt-1 flex items-center rounded-md border border-brand-cream-3 bg-card px-3 py-1.5">
                  <span className="text-sm text-brand-ink-3">Rp</span>
                  <input
                    inputMode="numeric"
                    value={form.openingBalance}
                    onChange={(e) => setForm(loc.id, 'openingBalance', e.target.value)}
                    placeholder="500000"
                    className="ml-2 flex-1 bg-transparent text-sm text-brand-ink focus:outline-none"
                  />
                </div>
              </label>
              <button
                type="button"
                onClick={() => handleCreate(loc.id)}
                disabled={pending}
                className="mt-4 w-full rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? 'Membuat...' : 'Buka kas kecil'}
              </button>
            </div>
          );
        })}

        {accounts.length === 0 && emptyLocations.length === 0 && (
          <div className="surface-card col-span-full p-6 text-center text-sm text-brand-ink-3">
            Tidak ada outlet aktif. Tambahkan outlet di Settings → Locations terlebih dahulu.
          </div>
        )}
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {/* Transaction history */}
      {selectedAccount && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-brand-ink">
              Riwayat Transaksi — {selectedAccount.locationName}
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openActionModal('topup')}
                className="rounded-md border border-brand-jade/30 bg-brand-jade-light px-3 py-1.5 text-xs font-semibold text-brand-jade hover:bg-brand-jade/15"
              >
                + Isi Ulang
              </button>
              <button
                type="button"
                onClick={() => openActionModal('expense')}
                className="rounded-md border border-brand-clay-light bg-brand-clay-light px-3 py-1.5 text-xs font-semibold text-brand-clay hover:bg-brand-clay/15"
              >
                − Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => openActionModal('deposit_to_bank')}
                className="rounded-md border border-brand-ink/15 bg-brand-cream-2 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-cream-3"
              >
                ↗ Setor ke Bank
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            {(['all', 'topup', 'expense', 'deposit_to_bank'] as const).map((kind) => {
              const isActive = kind === 'all' ? !filterKind : filterKind === kind;
              const label =
                kind === 'all'
                  ? 'Semua'
                  : kind === 'topup'
                    ? 'Isi Ulang'
                    : kind === 'expense'
                      ? 'Pengeluaran'
                      : 'Setor Bank';
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
                {txList.map((tx) => {
                  const isIncoming = tx.kind === 'topup';
                  const kindLabel =
                    tx.kind === 'topup'
                      ? 'Isi Ulang'
                      : tx.kind === 'expense'
                        ? 'Pengeluaran'
                        : tx.kind === 'deposit_to_bank'
                          ? 'Setor Bank'
                          : tx.kind;
                  const badgeColor =
                    tx.kind === 'topup'
                      ? 'bg-brand-jade-light text-brand-jade'
                      : tx.kind === 'expense'
                        ? 'bg-brand-clay-light text-brand-clay'
                        : 'bg-brand-cream-2 text-brand-ink-2';
                  return (
                    <tr key={tx.id} className="hover:bg-brand-cream/50">
                      <td className="px-4 py-3 text-brand-ink-2">{formatDate(tx.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}
                        >
                          {kindLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-brand-ink">{tx.description}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          isIncoming ? 'text-brand-jade' : 'text-brand-clay'
                        }`}
                      >
                        {isIncoming ? '+' : '-'}
                        {formatRupiah(tx.amount)}
                      </td>
                    </tr>
                  );
                })}
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

      {actionModal && selectedAccount ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="close"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setActionModal(null)}
          />
          <div className="relative z-10 flex w-full max-w-md flex-col rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl">
            <div className="border-b border-brand-cream-3 px-5 py-4">
              <h3 className="text-base font-semibold text-brand-ink">
                {actionModal === 'topup'
                  ? 'Isi Ulang Kas Kecil'
                  : actionModal === 'expense'
                    ? 'Catat Pengeluaran'
                    : 'Setor ke Bank'}
              </h3>
              <p className="mt-0.5 text-xs text-brand-ink-3">
                {actionModal === 'topup'
                  ? 'Jurnal otomatis: DR Kas Kecil · CR Kas'
                  : actionModal === 'expense'
                    ? 'Saldo kas kecil akan berkurang.'
                    : 'Jurnal otomatis: DR Bank · CR Kas Kecil'}
              </p>
            </div>
            <div className="space-y-3 p-5">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-brand-ink-2">
                  Nominal
                </span>
                <div className="mt-1 flex items-center rounded-md border border-brand-cream-3 bg-card px-3 py-2">
                  <span className="text-sm text-brand-ink-3">Rp</span>
                  <input
                    inputMode="numeric"
                    value={actionAmount}
                    onChange={(e) => setActionAmount(e.target.value.replace(/\D/g, ''))}
                    placeholder="0"
                    className="ml-2 flex-1 bg-transparent text-sm text-brand-ink focus:outline-none"
                    autoFocus
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-brand-ink-2">
                  Keterangan{actionModal === 'expense' ? ' *' : ' (opsional)'}
                </span>
                <input
                  type="text"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={
                    actionModal === 'topup'
                      ? 'Tambah modal kembalian'
                      : actionModal === 'expense'
                        ? 'Beli galon air, dsb'
                        : 'Setor ke Bank Mandiri a/n outlet'
                  }
                  className="mt-1 h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink focus:outline-none"
                />
              </label>
              {actionError ? (
                <p className="text-xs text-rose-600">{actionError}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-brand-cream-3 p-5">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                disabled={actionPending}
                className="h-10 rounded-md border border-brand-cream-3 text-sm font-medium text-brand-ink-2 hover:bg-brand-cream-2 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitAction}
                disabled={actionPending}
                className="h-10 rounded-md bg-brand-red text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
              >
                {actionPending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
