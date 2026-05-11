/**
 * Demo Channel Selector — channel buttons for demo POS.
 * Mirrors production `channel-selector.tsx` but uses demo cart context.
 */

'use client';

import { useDemoCart } from './demo-cart-context';
import { useTranslations } from 'next-intl';

const CHANNELS = [
  { id: 'walk_in', icon: '🏠' },
  { id: 'gofood', icon: '🛵' },
  { id: 'grabfood', icon: '🛵' },
  { id: 'shopeefood', icon: '🛵' },
] as const;

export function DemoChannelSelector() {
  const t = useTranslations('pos');
  const { state, setChannel } = useDemoCart();

  return (
    <div className="flex gap-2">
      {CHANNELS.map(ch => (
        <button
          key={ch.id}
          onClick={() => setChannel(ch.id)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
            state.channel === ch.id
              ? 'border-brand-red bg-brand-red/5 text-brand-red'
              : 'border-brand-cream-3 text-brand-ink-2 hover:border-brand-red/30'
          }`}
        >
          <span className="text-sm">{ch.icon}</span>
          <span>{t(`paymentMethods.${ch.id}` as never)}</span>
        </button>
      ))}
    </div>
  );
}