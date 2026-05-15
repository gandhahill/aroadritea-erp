/**
 * POS channel selector.
 *
 * Walk-in is always available. Delivery channels are read from POS settings so
 * commission and channel changes do not require source-code edits.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { type PosChannelOption, fetchPosChannelOptions } from './actions';
import { usePosCart } from './pos-cart-context';

function deliveryBadge(id: string) {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 3);
}

export function ChannelSelector() {
  const t = useTranslations('pos');
  const { state, setChannel } = usePosCart();
  const [deliveryChannels, setDeliveryChannels] = useState<PosChannelOption[]>([]);

  useEffect(() => {
    let alive = true;

    fetchPosChannelOptions(state.locationId)
      .then((rows) => {
        if (alive) setDeliveryChannels(rows);
      })
      .catch(() => {
        if (alive) setDeliveryChannels([]);
      });

    return () => {
      alive = false;
    };
  }, [state.locationId]);

  const channels = useMemo(
    () => [
      { id: 'walk_in', label: t('walkIn'), badge: 'POS' },
      ...deliveryChannels.map((channel) => ({
        id: channel.id,
        label: channel.label,
        badge: deliveryBadge(channel.id),
      })),
    ],
    [deliveryChannels, t],
  );

  useEffect(() => {
    if (channels.some((channel) => channel.id === state.channel)) return;
    setChannel('walk_in');
  }, [channels, setChannel, state.channel]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-widest text-brand-ink-3">
        {t('channel')}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {channels.map((channel) => (
          <button
            key={channel.id}
            type="button"
            onClick={() => setChannel(channel.id)}
            className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all ${
              state.channel === channel.id
                ? 'bg-brand-red text-white'
                : 'bg-brand-cream-2 text-brand-ink-2 hover:bg-brand-cream-3'
            }`}
          >
            <span
              aria-hidden="true"
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                state.channel === channel.id
                  ? 'bg-card/15 text-white'
                  : 'bg-brand-cream-3 text-brand-ink-3'
              }`}
            >
              {channel.badge}
            </span>
            <span>{channel.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
