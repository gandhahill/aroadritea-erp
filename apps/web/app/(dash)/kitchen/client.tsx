'use client';

import { toast } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import {
  type AdvanceKdsStatusResult,
  advanceKdsStatusAction,
  fetchKdsBoard,
  type KdsBoard,
  type KdsBoardItem,
  type KdsStatus,
  type KitchenLocationOption,
} from './actions';

const POLL_INTERVAL_MS = 8000;

const NEXT_STATUS: Partial<Record<KdsStatus, KdsStatus>> = {
  queued: 'making',
  making: 'ready',
  ready: 'served',
};

function elapsedMinutes(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export function KitchenBoardClient({
  locations,
  initialLocationId,
  initialBoard,
}: {
  locations: KitchenLocationOption[];
  initialLocationId: string;
  initialBoard: KdsBoard | null;
}) {
  const t = useTranslations('kitchen');
  const [locationId, setLocationId] = useState(initialLocationId);
  const [board, setBoard] = useState<KdsBoard | null>(initialBoard);
  const [now, setNow] = useState(() => Date.now());
  const [pendingId, setPendingId] = useState<string | null>(null);

  const refresh = useCallback(async (locId: string) => {
    if (!locId) return;
    const next = await fetchKdsBoard(locId);
    setBoard(next);
  }, []);

  useEffect(() => {
    refresh(locationId);
    const interval = setInterval(() => refresh(locationId), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [locationId, refresh]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  const handleAdvance = async (item: KdsBoardItem) => {
    const nextStatus = NEXT_STATUS[item.status];
    if (!nextStatus) return;

    setPendingId(item.id);
    try {
      const res: AdvanceKdsStatusResult = await advanceKdsStatusAction(
        item.id,
        nextStatus,
        locationId,
      );
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      await refresh(locationId);
    } finally {
      setPendingId(null);
    }
  };

  if (locations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-brand-cream-3 bg-card p-10 text-center text-sm text-brand-ink-3">
        {t('noLocations')}
      </div>
    );
  }

  const columns: { key: 'queued' | 'making' | 'ready'; label: string; actionLabel?: string }[] = [
    { key: 'queued', label: t('columns.queued'), actionLabel: t('actions.start') },
    { key: 'making', label: t('columns.making'), actionLabel: t('actions.markReady') },
    { key: 'ready', label: t('columns.ready'), actionLabel: t('actions.markServed') },
  ];

  return (
    <div className="space-y-4">
      {locations.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="kitchen-location" className="text-sm font-medium text-brand-ink-2">
            {t('selectLocation')}
          </label>
          <select
            id="kitchen-location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {columns.map((column) => {
          const items = board ? board[column.key] : [];
          return (
            <div
              key={column.key}
              className="rounded-xl border border-brand-cream-3 bg-card shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-brand-cream-3 px-4 py-3">
                <h2 className="font-display text-sm font-semibold text-brand-ink">
                  {column.label}
                </h2>
                <span className="rounded-full bg-brand-cream-2 px-2.5 py-0.5 text-xs font-semibold text-brand-ink-2">
                  {items.length}
                </span>
              </div>
              <div className="space-y-3 p-4">
                {items.length === 0 ? (
                  <p className="py-6 text-center text-sm text-brand-ink-3">{t('empty')}</p>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-brand-cream-3 bg-brand-cream/30 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-display text-2xl font-bold text-brand-red">
                          #{item.pickupNumber}
                        </span>
                        <span className="text-xs text-brand-ink-3">
                          {t('elapsedMinutes', { minutes: elapsedMinutes(item.queuedAt, now) })}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-brand-ink-2">{item.productSummary}</p>
                      {column.actionLabel && (
                        <button
                          type="button"
                          onClick={() => handleAdvance(item)}
                          disabled={pendingId === item.id}
                          className="mt-3 w-full rounded-md bg-brand-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-red-dark disabled:opacity-50"
                        >
                          {pendingId === item.id ? t('actions.updating') : column.actionLabel}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
