/**
 * POS Cart Context — manages the current order cart state client-side.
 * This context holds the in-progress order before payment is processed.
 */

'use client';

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { evaluateCartPromotionsAction, applyVoucherAction } from './actions';

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
  lineDiscountReason?: string;
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
  voucherCode: string;
}

interface PosCartContextValue {
  state: CartState;
  setShiftId: (id: string | null) => void;
  setChannel: (c: string) => void;
  addLine: (line: Omit<CartLine, 'id'>) => void;
  updateLineQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  updateLineNotes: (lineId: string, notes: string) => void;
  updateLineDiscount: (lineId: string, discount: string, reason: string) => void;
  setCustomer: (customer: CartCustomer) => void;
  clearCustomer: () => void;
  setVoucherCode: (code: string) => void;
  setAppliedVoucherDiscount: (discount: bigint) => void;
  addPayment: (payment: Omit<CartPayment, 'id'>) => void;
  removePayment: (id: string) => void;
  setNotes: (n: string) => void;
  clearCart: () => void;
  loadCart: (state: CartState) => void;
  subtotal: bigint;
  totalPaid: bigint;
  remainingBalance: bigint;
  grandTotal: bigint;
  autoDiscountTotal: bigint;
  appliedVoucherDiscount: bigint;
}

const defaultState: CartState = {
  shiftId: null,
  locationId: '',
  tenantId: '',
  channel: 'dine_in',
  lines: [],
  payments: [],
  customer: null,
  notes: '',
  voucherCode: '',
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
  const [autoDiscountTotal, setAutoDiscountTotal] = useState<bigint>(BigInt(0));
  const [appliedVoucherDiscount, setAppliedVoucherDiscount] = useState<bigint>(BigInt(0));
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

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

  const setCustomer = useCallback((customer: CartCustomer) => {
    setState((s) => ({ ...s, customer }));
  }, []);

  const clearCustomer = useCallback(() => {
    setState((s) => ({ ...s, customer: null, voucherCode: '' }));
    setAppliedVoucherDiscount(BigInt(0));
  }, []);

  const setVoucherCode = useCallback((code: string) => {
    setState((s) => ({ ...s, voucherCode: code }));
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

  const loadCart = useCallback((newState: CartState) => {
    setState(newState);
  }, []);

  const clearCart = useCallback(() => {
    setState((s) => ({ ...s, lines: [], payments: [], customer: null, notes: '', voucherCode: '' }));
    setAppliedVoucherDiscount(BigInt(0));
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
  
  let finalGrandTotal = subtotalAfterDiscount - autoDiscountTotal - appliedVoucherDiscount;
  if (finalGrandTotal < BigInt(0)) finalGrandTotal = BigInt(0);
  const grandTotal = finalGrandTotal;
  
  const totalPaid = state.payments.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
  const remainingBalance = grandTotal - totalPaid > BigInt(0) ? grandTotal - totalPaid : BigInt(0);

  useEffect(() => {
    if (state.lines.length === 0) {
      setAutoDiscountTotal(BigInt(0));
      return;
    }
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await evaluateCartPromotionsAction({
          channel: state.channel,
          lines: state.lines.map((l) => ({
            productId: l.productId,
            qty: l.qty,
            unitPrice: l.unitPrice,
          })),
        });
        setAutoDiscountTotal(BigInt(result.totalDiscount));
      } catch (e) {
        console.error('Failed to evaluate promotions', e);
      }
    }, 500);
  }, [state.lines, state.channel]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      // Scope display channel per tenant+location so multiple outlets in
      // the same browser don't share state.
      const channelName = `pos-display-${state.tenantId || 'default'}-${state.locationId || 'unset'}`;
      const channel = new BroadcastChannel(channelName);
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
        updateLineDiscount,
        setCustomer,
        clearCustomer,
        setVoucherCode,
        setAppliedVoucherDiscount,
        addPayment,
        removePayment,
        setNotes,
        clearCart,
        loadCart,
        subtotal: subtotalAfterDiscount,
        totalPaid,
        remainingBalance,
        grandTotal,
        autoDiscountTotal,
        appliedVoucherDiscount,
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
