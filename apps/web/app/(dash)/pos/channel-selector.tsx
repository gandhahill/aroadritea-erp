/**
 * Channel Selector — SD §21.4
 *
 * Selects the order channel: walk_in | gofood | grabfood | shopeefood
 */

'use client';

import { useTranslations } from 'next-intl';
import { usePosCart } from './pos-cart-context';

const CHANNELS = [
  { id: 'walk_in', icon: '🏠', labelKey: 'walkIn' },
  { id: 'gofood', icon: '🛵', labelKey: 'goFood' },
  { id: 'grabfood', icon: '🛵', labelKey: 'grabFood' },
  { id: 'shopeefood', icon: '🛵', labelKey: 'shopeeFood' },
] as const;

export function ChannelSelector() {
  const t = useTranslations('pos');
  const { state, setChannel } = usePosCart();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-widest text-brand-ink-3">
        {t('channel')}
      </span>
      <div className="flex gap-1.5">
        {CHANNELS.map(ch => (
          <button
            key={ch.id}
            onClick={() => setChannel(ch.id)}
            className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all ${
              state.channel === ch.id
                ? 'bg-brand-red text-white'
                : 'bg-brand-cream-2 text-brand-ink-2 hover:bg-brand-cream-3'
            }`}
          >
            <span>{ch.icon}</span>
            <span>{t(ch.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
