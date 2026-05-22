/**
 * Demo Cart Context — manages the in-memory demo order cart.
 *
 * Mirrors the production `pos-cart-context.tsx` API but is purely client-side,
 * with no server actions. This is the cart state for the demo POS.
 *
 * ADR-0008: demo cart state is in-memory only (never persisted).
 */

'use client';

import type { DemoCartCustomer, DemoCartLine, DemoCartPayment, DemoCartState } from '@erp/offline';
import { calcDemoTotals } from '@erp/offline';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';

interface DemoCartContextValue {
  state: DemoCartState;
  setChannel: (c: DemoCartState['channel']) => void;
  addLine: (line: Omit<DemoCartLine, 'id'>) => void;
  updateLineQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  updateLineNotes: (lineId: string, notes: string) => void;
  updateLineDiscount: (lineId: string, discount: string, reason: string) => void;
  addPayment: (payment: Omit<DemoCartPayment, 'id'>) => void;
  removePayment: (id: string) => void;
  setNotes: (n: string) => void;
  setCustomer: (c: DemoCartCustomer) => void;
  clearCustomer: () => void;
  setGuestName: (name: string) => void;
  clearCart: () => void;
  subtotal: bigint;
  totalPaid: bigint;
  remainingBalance: bigint;
  grandTotal: bigint;
  taxTotal: bigint;
  excess: bigint;
}

const defaultState: DemoCartState = {
  channel: 'dine_in',
  lines: [],
  payments: [],
  notes: '',
  customer: null,
  guestName: '',
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

  const updateLineDiscount = useCallback((lineId: string, discount: string, reason: string) => {
    setState((s) => ({
      ...s,
      lines: s.lines.map((l) =>
        l.id === lineId
          ? {
              ...l,
              lineDiscount: /^\d+$/.test(discount) ? discount : '0',
              lineDiscountReason: reason.trim() || undefined,
            }
          : l,
      ),
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

  const setCustomer = useCallback((c: DemoCartCustomer) => {
    setState((s) => ({ ...s, customer: c }));
  }, []);

  const clearCustomer = useCallback(() => {
    setState((s) => ({ ...s, customer: null }));
  }, []);

  const setGuestName = useCallback((name: string) => {
    setState((s) => ({ ...s, guestName: name }));
  }, []);

  const clearCart = useCallback(() => {
    setState((s) => ({
      ...s,
      lines: [],
      payments: [],
      notes: '',
      customer: null,
      guestName: '',
    }));
  }, []);

  const { subtotal, taxTotal, totalPaid, remainingBalance, grandTotal, excess } =
    calcDemoTotals(state);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      // Demo POS uses a separate channel from the real POS so a demo session
      // never bleeds into a real customer display.
      const channel = new BroadcastChannel('pos-display-demo-default-demo');
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
        updateLineDiscount,
        addPayment,
        removePayment,
        setNotes,
        setCustomer,
        clearCustomer,
        setGuestName,
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
