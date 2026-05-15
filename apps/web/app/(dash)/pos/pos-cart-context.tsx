/**
 * POS Cart Context — manages the current order cart state client-side.
 * This context holds the in-progress order before payment is processed.
 */

'use client';

import { type ReactNode, createContext, useCallback, useContext, useState } from 'react';

export interface CartLine {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  qty: number;
  unitPrice: string; // bigint string
  modifierJson?: Record<string, unknown>;
  notes?: string;
  lineDiscount?: string;
}

export interface CartPayment {
  id: string;
  method: string;
  amount: string;
  reference?: string;
}

export interface CartCustomer {
  id: string;
  name: string;
  phone: string | null;
  loyaltyTier: string;
  points: number;
}

export interface CartState {
  shiftId: string | null;
  locationId: string;
  tenantId: string;
  channel: string;
  lines: CartLine[];
  payments: CartPayment[];
  customer: CartCustomer | null;
  notes: string;
}

interface PosCartContextValue {
  state: CartState;
  setShiftId: (id: string | null) => void;
  setChannel: (c: string) => void;
  addLine: (line: Omit<CartLine, 'id'>) => void;
  updateLineQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  updateLineNotes: (lineId: string, notes: string) => void;
  setCustomer: (customer: CartCustomer) => void;
  clearCustomer: () => void;
  addPayment: (payment: Omit<CartPayment, 'id'>) => void;
  removePayment: (id: string) => void;
  setNotes: (n: string) => void;
  clearCart: () => void;
  subtotal: bigint;
  totalPaid: bigint;
  remainingBalance: bigint;
  grandTotal: bigint;
}

const defaultState: CartState = {
  shiftId: null,
  locationId: '',
  tenantId: '',
  channel: 'walk_in',
  lines: [],
  payments: [],
  customer: null,
  notes: '',
};

const PosCartContext = createContext<PosCartContextValue | null>(null);

export function PosCartProvider({
  children,
  locationId,
  tenantId,
}: {
  children: ReactNode;
  locationId: string;
  tenantId: string;
}) {
  const [state, setState] = useState<CartState>({
    ...defaultState,
    locationId,
    tenantId,
  });

  const setShiftId = useCallback((id: string | null) => {
    setState((s) => ({ ...s, shiftId: id }));
  }, []);

  const setChannel = useCallback((c: string) => {
    setState((s) => ({ ...s, channel: c }));
  }, []);

  const addLine = useCallback((line: Omit<CartLine, 'id'>) => {
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

  const setCustomer = useCallback((customer: CartCustomer) => {
    setState((s) => ({ ...s, customer }));
  }, []);

  const clearCustomer = useCallback(() => {
    setState((s) => ({ ...s, customer: null }));
  }, []);

  const addPayment = useCallback((payment: Omit<CartPayment, 'id'>) => {
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
    setState((s) => ({ ...s, lines: [], payments: [], customer: null, notes: '' }));
  }, []);

  // Derived values
  const subtotal = state.lines.reduce(
    (sum, l) => sum + BigInt(l.unitPrice) * BigInt(l.qty),
    BigInt(0),
  );
  const totalDiscount = state.lines.reduce(
    (sum, l) => sum + BigInt(l.lineDiscount ?? '0'),
    BigInt(0),
  );
  const subtotalAfterDiscount = subtotal - totalDiscount;
  const grandTotal = subtotalAfterDiscount;
  const totalPaid = state.payments.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
  const remainingBalance = grandTotal - totalPaid > BigInt(0) ? grandTotal - totalPaid : BigInt(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('pos-display');
      channel.postMessage({
        state,
        subtotal: subtotalAfterDiscount.toString(),
        totalPaid: totalPaid.toString(),
        remainingBalance: remainingBalance.toString(),
        grandTotal: grandTotal.toString(),
      });
      channel.close();
    }
  }, [state, subtotalAfterDiscount, totalPaid, remainingBalance, grandTotal]);

  return (
    <PosCartContext.Provider
      value={{
        state,
        setShiftId,
        setChannel,
        addLine,
        updateLineQty,
        removeLine,
        updateLineNotes,
        setCustomer,
        clearCustomer,
        addPayment,
        removePayment,
        setNotes,
        clearCart,
        subtotal: subtotalAfterDiscount,
        totalPaid,
        remainingBalance,
        grandTotal,
      }}
    >
      {children}
    </PosCartContext.Provider>
  );
}

export function usePosCart(): PosCartContextValue {
  const ctx = useContext(PosCartContext);
  if (!ctx) throw new Error('usePosCart must be used inside PosCartProvider');
  return ctx;
}
