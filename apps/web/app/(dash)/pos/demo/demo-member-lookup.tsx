/**
 * Demo Member Lookup — mirrors the production POS member-lookup but
 * NEVER hits the server. The demo POS is an isolated sandbox
 * (ADR-0008); leaking demo lookups into the real `members` table or
 * the OTP rate limiter would pollute production. Cashier enters the
 * member's name (and optional phone/tier/points) manually.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useDemoCart } from './demo-cart-context';

export function DemoMemberLookup() {
  const t = useTranslations('pos');
  const { state, setCustomer, clearCustomer, setGuestName } = useDemoCart();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  if (state.customer) {
    return (
      <section className="border-b border-brand-cream-3 bg-brand-jade/5 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-jade">
              {t('memberAttached')} · DEMO
            </p>
            <p className="truncate text-sm font-semibold text-brand-ink">{state.customer.name}</p>
            {state.customer.phone && (
              <p className="text-xs text-brand-ink-3">{state.customer.phone}</p>
            )}
          </div>
          <button
            type="button"
            onClick={clearCustomer}
            className="h-9 rounded-md border border-brand-jade/30 px-3 text-xs font-semibold text-brand-jade hover:bg-brand-jade/10"
          >
            {t('memberClear')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-brand-cream-3 bg-brand-cream-1/70 px-4 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink-3">
        {t('memberQuestion')} · DEMO
      </p>

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="h-10 w-full rounded-md border border-dashed border-brand-cream-3 bg-card px-3 text-xs font-medium text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red"
        >
          + {t('memberLookup')}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama member"
            className="h-10 rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
          />
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="No HP (opsional)"
            className="h-10 rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!name.trim()) return;
                setCustomer({ name: name.trim(), phone: phone.trim() || undefined });
                setShowForm(false);
                setName('');
                setPhone('');
              }}
              disabled={!name.trim()}
              className="h-9 flex-1 rounded-md bg-brand-red px-3 text-xs font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('memberYes')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setName('');
                setPhone('');
              }}
              className="h-9 rounded-md border border-brand-cream-3 px-3 text-xs font-semibold text-brand-ink-2 hover:bg-brand-cream-2"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink-3">
          {t('guestName')}
        </label>
        <input
          type="text"
          value={state.guestName ?? ''}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder={t('guestNamePlaceholder')}
          className="mt-1 h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm font-medium text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
        />
      </div>
    </section>
  );
}
