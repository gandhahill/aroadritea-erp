'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface DisplayItem {
  id: string;
  pickupNumber: number;
}

interface DisplayQueue {
  queued: DisplayItem[];
  making: DisplayItem[];
  ready: DisplayItem[];
}

const EMPTY_QUEUE: DisplayQueue = { queued: [], making: [], ready: [] };

export function KitchenDisplayClient({
  locationId,
  locationLabel,
}: {
  locationId: string;
  locationLabel: string;
}) {
  const t = useTranslations('kitchenDisplay');
  const [queue, setQueue] = useState<DisplayQueue>(EMPTY_QUEUE);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource(`/api/kitchen/display/${locationId}`);

    source.addEventListener('queue_update', (event) => {
      setConnected(true);
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { data: DisplayQueue };
        setQueue(payload.data);
      } catch {
        // Ignore malformed events — the next poll tick will recover.
      }
    });

    source.onerror = () => setConnected(false);

    return () => source.close();
  }, [locationId]);

  const columns: { key: keyof DisplayQueue; label: string; highlight?: boolean }[] = [
    { key: 'queued', label: t('columns.queued') },
    { key: 'making', label: t('columns.making') },
    { key: 'ready', label: t('columns.ready'), highlight: true },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-brand-ink px-8 py-6 text-brand-cream">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
          <p className="text-brand-cream-3">{locationLabel}</p>
        </div>
        <span
          className={`h-3 w-3 rounded-full ${connected ? 'bg-brand-jade' : 'bg-brand-red'}`}
          title={connected ? t('connected') : t('disconnected')}
        />
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-3">
        {columns.map((column) => (
          <div
            key={column.key}
            className={`rounded-2xl p-6 ${column.highlight ? 'bg-brand-red' : 'bg-brand-ink-2'}`}
          >
            <h2 className="mb-4 text-xl font-semibold uppercase tracking-wide">{column.label}</h2>
            {queue[column.key].length === 0 ? (
              <p className="text-brand-cream-3">{t('empty')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {queue[column.key].map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-center rounded-xl bg-brand-ink py-6 text-4xl font-bold"
                  >
                    {item.pickupNumber}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
