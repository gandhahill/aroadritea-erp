'use client';

import { useEffect, useState } from 'react';

interface CartLine {
  id: string;
  productName: string;
  variantName?: string;
  qty: number;
  unitPrice: string;
}

interface DisplayState {
  lines: CartLine[];
}

export default function PosDisplayPage() {
  const [displayState, setDisplayState] = useState<DisplayState | null>(null);
  const [grandTotal, setGrandTotal] = useState<string>('0');
  const [totalPaid, setTotalPaid] = useState<string>('0');
  const [remainingBalance, setRemainingBalance] = useState<string>('0');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('pos-display');
      channel.onmessage = (event) => {
        const { state, grandTotal, totalPaid, remainingBalance } = event.data;
        setDisplayState(state);
        setGrandTotal(grandTotal);
        setTotalPaid(totalPaid);
        setRemainingBalance(remainingBalance);
      };
      return () => channel.close();
    }
  }, []);

  if (!displayState) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-brand-cream bg-[url('/brand-assets/logo-monochrome.png')] bg-center bg-no-repeat bg-[length:30%] bg-blend-soft-light">
        <h1 className="text-4xl font-display font-semibold text-brand-ink/50">Welcome to Aroadri Tea</h1>
        <p className="mt-4 text-xl text-brand-ink-3">Silakan pesan di kasir</p>
      </div>
    );
  }

  const lines = displayState.lines || [];

  return (
    <div className="flex h-screen w-full flex-col bg-brand-cream overflow-hidden">
      {/* Header */}
      <header className="flex h-20 shrink-0 items-center justify-between border-b-2 border-brand-cream-3 bg-card px-8">
        <div className="flex items-center gap-4">
          <img src="/logo-primary.png" alt="Aroadri Tea" className="h-12 w-12" />
          <span className="font-display text-2xl font-bold text-brand-ink">Aroadri Tea</span>
        </div>
        <h1 className="text-xl font-medium text-brand-ink-2">Daftar Pesanan Anda</h1>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Item List */}
        <div className="flex w-2/3 flex-col bg-card overflow-hidden border-r border-brand-cream-3">
          <div className="flex-1 overflow-y-auto p-8">
            {lines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center opacity-50">
                <span className="text-6xl mb-4">🧋</span>
                <p className="text-2xl text-brand-ink-3">Belum ada pesanan</p>
              </div>
            ) : (
              <ul className="space-y-4">
                {lines.map((line) => {
                  const lineTotal = BigInt(line.unitPrice) * BigInt(line.qty);
                  return (
                    <li key={line.id} className="flex items-start justify-between rounded-xl border border-brand-cream-3 p-6 shadow-sm">
                      <div className="flex gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-cream-2 text-xl font-bold text-brand-ink">
                          {line.qty}x
                        </div>
                        <div>
                          <p className="text-xl font-semibold text-brand-ink">{line.productName}</p>
                          {line.variantName && (
                            <p className="text-base text-brand-ink-3">{line.variantName}</p>
                          )}
                        </div>
                      </div>
                      <p className="text-xl font-bold text-brand-ink">{formatRupiah(lineTotal.toString())}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Payment Totals */}
        <div className="flex w-1/3 flex-col bg-brand-cream-1 p-8 justify-center">
          <div className="rounded-2xl border-2 border-brand-cream-3 bg-card p-8 shadow-md">
            <h2 className="mb-6 text-center font-display text-3xl font-bold text-brand-ink">Total Pembayaran</h2>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-brand-cream-3 pb-6">
                <span className="text-2xl text-brand-ink-2">Total</span>
                <span className="text-4xl font-bold text-brand-ink">{formatRupiah(grandTotal)}</span>
              </div>

              {BigInt(totalPaid) > BigInt(0) && (
                <div className="flex justify-between items-center border-b border-brand-cream-3 pb-6">
                  <span className="text-xl text-brand-ink-3">Dibayar</span>
                  <span className="text-2xl font-semibold text-green-600">{formatRupiah(totalPaid)}</span>
                </div>
              )}

              {BigInt(remainingBalance) > BigInt(0) && (
                <div className="flex justify-between items-center pt-2">
                  <span className="text-2xl font-semibold text-brand-ink-2">Sisa</span>
                  <span className="text-4xl font-bold text-brand-red">{formatRupiah(remainingBalance)}</span>
                </div>
              )}

              {BigInt(remainingBalance) === BigInt(0) && BigInt(totalPaid) > BigInt(0) && (
                <div className="mt-8 rounded-xl bg-green-100 p-6 text-center">
                  <p className="text-2xl font-bold text-green-700">Lunas!</p>
                  <p className="text-lg text-green-600">Terima kasih atas pesanannya</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatRupiah(value: string | bigint): string {
  const num = Number(value);
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}
