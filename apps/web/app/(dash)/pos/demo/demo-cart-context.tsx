/**
 * Demo Cart Context — manages the in-memory demo order cart.
 *
 * Mirrors the production `pos-cart-context.tsx` API but is purely client-side,
 * with no server actions. This is the cart state for the demo POS.
 *
 * ADR-0008: demo cart state is in-memory only (never persisted).
 */

'use client';

import type { DemoCartLine, DemoCartPayment, DemoCartState } from '@erp/offline';
import { calcDemoTotals } from '@erp/offline';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';

interface DemoCartContextValue {
  state: DemoCartState;
  setChannel: (c: DemoCartState['channel']) => void;
  addLine: (line: Omit<DemoCartLine, 'id'>) => void;
  updateLineQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  updateLineNotes: (lineId: string, notes: string) => void;
  addPayment: (payment: Omit<DemoCartPayment, 'id'>) => void;
  removePayment: (id: string) => void;
  setNotes: (n: string) => void;
  clearCart: () => void;
  subtotal: bigint;
  totalPaid: bigint;
  remainingBalance: bigint;
  grandTotal: bigint;
  taxTotal: bigint;
  excess: bigint;
}

const defaultState: DemoCartState = {
  channel: 'walk_in',
  lines: [],
  payments: [],
  notes: '',
};

const DemoCartContext = createContext<DemoCartContextValue | null>(null);

export function DemoCartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoCartState>(defaultState);

  const setChannel = useCallback((c: DemoCartState['channel']) => {
    setState((s) => ({ ...s, channel: c }));
  }, []);

  const addLine = useCallback((line: Omit<DemoCartLine, 'id'>) => {
    setState((s) => ({
      ...s,
      lines: [...s.lines, { ...line, id: crypto.randomUUID() }],
    }));
  }, []);

  const updateLineQty = useCallback((lineId: string, qty: number) => {
    setState((s) => ({
      ...s,
      lines: s.lines.map((l) => (l.id === lineId ? { ...l, qty } : l)),
    }));
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setState((s) => ({ ...s, lines: s.lines.filter((l) => l.id !== lineId) }));
  }, []);

  const updateLineNotes = useCallback((lineId: string, notes: string) => {
    setState((s) => ({
      ...s,
      lines: s.lines.map((l) => (l.id === lineId ? { ...l, notes } : l)),
    }));
  }, []);

  const addPayment = useCallback((payment: Omit<DemoCartPayment, 'id'>) => {
    setState((s) => ({
      ...s,
      payments: [...s.payments, { ...payment, id: crypto.randomUUID() }],
    }));
  }, []);

  const removePayment = useCallback((id: string) => {
    setState((s) => ({ ...s, payments: s.payments.filter((p) => p.id !== id) }));
  }, []);

  const setNotes = useCallback((n: string) => {
    setState((s) => ({ ...s, notes: n }));
  }, []);

  const clearCart = useCallback(() => {
    setState((s) => ({ ...s, lines: [], payments: [], notes: '' }));
  }, []);

  const { subtotal, taxTotal, totalPaid, remainingBalance, grandTotal, excess } =
    calcDemoTotals(state);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('pos-display');
      channel.postMessage({
        state,
        subtotal: subtotal.toString(),
        totalPaid: totalPaid.toString(),
        remainingBalance: remainingBalance.toString(),
        grandTotal: grandTotal.toString(),
      });
      channel.close();
    }
  }, [state, subtotal, totalPaid, remainingBalance, grandTotal]);

  return (
    <DemoCartContext.Provider
      value={{
        state,
        setChannel,
        addLine,
        updateLineQty,
        removeLine,
        updateLineNotes,
        addPayment,
        removePayment,
        setNotes,
        clearCart,
        subtotal,
        totalPaid,
        remainingBalance,
        grandTotal,
        taxTotal,
        excess,
      }}
    >
      {children}
    </DemoCartContext.Provider>
  );
}

export function useDemoCart(): DemoCartContextValue {
  const ctx = useContext(DemoCartContext);
  if (!ctx) throw new Error('useDemoCart must be used inside DemoCartProvider');
  return ctx;
}
