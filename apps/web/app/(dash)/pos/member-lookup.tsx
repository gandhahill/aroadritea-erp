/**
 * POS member lookup by phone number.
 *
 * Operational flow: cashier asks whether the customer is a member, enters the
 * phone number, then confirms the name before attaching the customer to order.
 */

'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState, useTransition } from 'react';
import { type MemberLookupActionResult, lookupMemberByPhoneAction } from './actions';
import { usePosCart } from './pos-cart-context';
import { Input } from "@erp/ui";

type FoundMember = NonNullable<Extract<MemberLookupActionResult, { ok: true }>['member']>;

/** Extract the "a/n:" prefix from cart notes so we can edit it independently.
 *  Greedy on the guest segment so back-to-back keystrokes don't accumulate a
 *  trailing chain of partial values ("a/n: Lintang | Lintan | Linta | …"). */
function extractGuestName(notes: string): { guest: string; rest: string } {
  const match = notes.match(/^a\/n:\s*([^|]+?)\s*(?:\|\s*(.*))?$/i);
  if (!match) return { guest: '', rest: notes };
  return { guest: (match[1] ?? '').trim(), rest: (match[2] ?? '').trim() };
}

function composeNotes(guest: string, rest: string): string {
  const g = guest.trim();
  const r = rest.trim();
  if (!g) return r;
  if (!r) return `a/n: ${g}`;
  return `a/n: ${g} | ${r}`;
}

export function MemberLookup() {
  const t = useTranslations('pos');
  const { state, setCustomer, clearCustomer, setNotes } = usePosCart();
  const { guest: initialGuest } = extractGuestName(state.notes);
  const [phone, setPhone] = useState('');
  const [candidate, setCandidate] = useState<FoundMember | null>(null);
  const [messageKey, setMessageKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [guestName, setGuestName] = useState(initialGuest);

  // Keep the local input in sync with cart notes — e.g. when clearCart()
  // wipes the cart after a successful payment, the input must reset too.
  useEffect(() => {
    setGuestName(initialGuest);
  }, [initialGuest]);

  function commitGuestName(next: string) {
    setGuestName(next);
    const { rest } = extractGuestName(state.notes);
    setNotes(composeNotes(next, rest));
  }

  function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPhone = phone.trim();
    if (trimmedPhone.length < 8) {
      setCandidate(null);
      setMessageKey('memberPhoneInvalid');
      return;
    }

    startTransition(async () => {
      setMessageKey(null);
      setCandidate(null);
      const result = await lookupMemberByPhoneAction(trimmedPhone);

      if (!result.ok) {
        setMessageKey('memberLookupFailed');
        return;
      }
      if (!result.member) {
        setMessageKey('memberNotFound');
        return;
      }

      setCandidate(result.member);
    });
  }

  function confirmCandidate() {
    if (!candidate) return;
    setCustomer({
      id: candidate.memberId,
      name: candidate.name,
      phone: candidate.phone,
      loyaltyTier: candidate.loyaltyTier,
      points: candidate.points,
    });
    setCandidate(null);
    setMessageKey(null);
    setPhone('');
  }

  if (state.customer) {
    return (
      <section className="border-b border-brand-cream-3 bg-brand-jade/5 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-jade">
              {t('memberAttached')}
            </p>
            <p className="truncate text-sm font-semibold text-brand-ink">{state.customer.name}</p>
            <p className="text-xs text-brand-ink-3">
              {t('memberPoints', { points: state.customer.points })}
            </p>
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
        {t('memberQuestion')}
      </p>
      <form className="flex gap-2" onSubmit={handleLookup}>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder={t('memberPhonePlaceholder')}
          className="h-10 min-w-0 flex-1 rounded-md border border-brand-cream-3 bg-card px-3 text-sm font-medium text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-md bg-brand-ink px-4 text-xs font-semibold text-white hover:bg-brand-red disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? t('memberSearching') : t('memberLookup')}
        </button>
      </form>

      {messageKey && (
        <p className="mt-2 text-xs font-medium text-brand-red">{t(messageKey as never)}</p>
      )}

      {candidate && (
        <div className="mt-3 rounded-md border border-brand-red/25 bg-card p-3 shadow-sm">
          <p className="text-xs text-brand-ink-3">{t('memberConfirmName')}</p>
          <p className="mt-0.5 text-base font-semibold text-brand-ink">{candidate.name}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={confirmCandidate}
              className="h-9 rounded-md bg-brand-red px-3 text-xs font-semibold text-white hover:bg-brand-red-dark"
            >
              {t('memberYes')}
            </button>
            <button
              type="button"
              onClick={() => setCandidate(null)}
              className="h-9 rounded-md border border-brand-cream-3 px-3 text-xs font-semibold text-brand-ink-2 hover:bg-brand-cream-2"
            >
              {t('memberNo')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink-3">
          {t('guestName')}
        </label>
        <Input
          type="text"
          value={guestName}
          onChange={(event) => commitGuestName(event.target.value)}
          placeholder={t('guestNamePlaceholder')}
          className="mt-1 h-10 w-full rounded-md border border-brand-cream-3 bg-card px-3 text-sm font-medium text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
        />
      </div>
    </section>
  );
}
