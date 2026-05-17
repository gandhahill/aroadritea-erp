/**
 * Demo Channel Selector — pixel parity with production `channel-selector.tsx`.
 *
 * The demo runs entirely client-side so it cannot read posSettings; it ships
 * a static set of channels but renders them with the exact same look as the
 * real selector (no emoji, brand-token pills).
 */

'use client';

import { useTranslations } from 'next-intl';
import { useDemoCart } from './demo-cart-context';

const CHANNELS = [
  { id: 'dine_in', badge: 'DIN', labelKey: 'dineIn' as const },
  { id: 'take_away', badge: 'TA', labelKey: 'takeAway' as const },
  { id: 'gofood', badge: 'GF', labelKey: 'gofood' as const },
  { id: 'grabfood', badge: 'GB', labelKey: 'grabfood' as const },
  { id: 'shopeefood', badge: 'SF', labelKey: 'shopeefood' as const },
] as const;

export function DemoChannelSelector() {
  const t = useTranslations('pos');
  const { state, setChannel } = useDemoCart();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-widest text-brand-ink-3">
        {t('channel')}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {CHANNELS.map((channel) => (
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
            <span>{t(channel.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
