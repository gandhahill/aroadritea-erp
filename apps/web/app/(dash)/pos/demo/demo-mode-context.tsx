/**
 * Demo Mode Context — shared state for demo mode activation/deactivation.
 *
 * Provides:
 * - `isDemoMode`: boolean
 * - `activateDemo`: async function to init demo + snapshot master data
 * - `deactivateDemo`: async function to wipe demo DB + redirect to production POS
 * - `demoOrderHistory`: list of completed demo orders (in-memory, ephemeral)
 * - `addDemoOrder`: add a completed demo order to history
 *
 * ADR-0008: always client-side, never touches server.
 */

'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  snapshotMasterData,
  isMasterStale,
  getMasterSnapshotAgeHuman,
  wipeDemoDb,
  getNextDemoOrderNumber,
  type SnapshotResult,
} from '@erp/offline';
import type { DemoOrder, DemoCartState } from '@erp/offline';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DemoModeState {
  isDemoMode: boolean;
  masterSnapshotAge: string | null;
  isMasterStale: boolean;
  snapshotLoading: boolean;
  snapshotError: string | null;
}

interface DemoModeActions {
  activateDemo: () => Promise<void>;
  deactivateDemo: () => Promise<void>;
  refreshSnapshot: () => Promise<void>;
  addDemoOrder: (order: DemoOrder) => void;
  clearDemoOrders: () => void;
}

type DemoModeContextValue = DemoModeState & DemoModeActions & {
  demoOrderHistory: DemoOrder[];
};

// ─── Context ────────────────────────────────────────────────────────────────────

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────────

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoModeState>({
    isDemoMode: false,
    masterSnapshotAge: null,
    isMasterStale: false,
    snapshotLoading: false,
    snapshotError: null,
  });

  const [demoOrderHistory, setDemoOrderHistory] = useState<DemoOrder[]>([]);

  const activateDemo = useCallback(async () => {
    setState(s => ({ ...s, snapshotLoading: true, snapshotError: null }));
    try {
      const result: SnapshotResult = await snapshotMasterData();
      if (!result.success) {
        setState(s => ({
          ...s,
          snapshotLoading: false,
          snapshotError: result.errors.join('; '),
        }));
        return;
      }

      const [age, stale] = await Promise.all([
        getMasterSnapshotAgeHuman(),
        isMasterStale(),
      ]);

      setState({
        isDemoMode: true,
        masterSnapshotAge: age,
        isMasterStale: stale,
        snapshotLoading: false,
        snapshotError: null,
      });
    } catch (err) {
      setState(s => ({
        ...s,
        snapshotLoading: false,
        snapshotError: err instanceof Error ? err.message : 'Snapshot failed',
      }));
    }
  }, []);

  const deactivateDemo = useCallback(async () => {
    await wipeDemoDb();
    setDemoOrderHistory([]);
    setState({
      isDemoMode: false,
      masterSnapshotAge: null,
      isMasterStale: false,
      snapshotLoading: false,
      snapshotError: null,
    });
  }, []);

  const refreshSnapshot = useCallback(async () => {
    setState(s => ({ ...s, snapshotLoading: true, snapshotError: null }));
    try {
      await snapshotMasterData();
      const [age, stale] = await Promise.all([
        getMasterSnapshotAgeHuman(),
        isMasterStale(),
      ]);
      setState(s => ({
        ...s,
        snapshotLoading: false,
        masterSnapshotAge: age,
        isMasterStale: stale,
      }));
    } catch (err) {
      setState(s => ({
        ...s,
        snapshotLoading: false,
        snapshotError: err instanceof Error ? err.message : 'Refresh failed',
      }));
    }
  }, []);

  const addDemoOrder = useCallback((order: DemoOrder) => {
    setDemoOrderHistory(prev => [order, ...prev]);
  }, []);

  const clearDemoOrders = useCallback(() => {
    setDemoOrderHistory([]);
  }, []);

  return (
    <DemoModeContext.Provider
      value={{
        ...state,
        activateDemo,
        deactivateDemo,
        refreshSnapshot,
        demoOrderHistory,
        addDemoOrder,
        clearDemoOrders,
      }}
    >
      {children}
    </DemoModeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDemoMode(): DemoModeContextValue {
  const ctx = useContext(DemoModeContext);
  if (!ctx) {
    throw new Error('useDemoMode must be used inside <DemoModeProvider>');
  }
  return ctx;
}
