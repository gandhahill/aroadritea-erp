'use client';

export type RoundingOption = 'donate' | 'round_up' | 'custom' | 'no_donation';

export interface DonationChoice {
  type: RoundingOption;
  amount: bigint;
  description: string;
}

export interface DonationResult {
  choice: DonationChoice;
  originalChange: bigint;
  cashReturned: bigint;
  donatedAmount: bigint;
}

const ROUNDING_THRESHOLD = 100n;

/**
 * Calculate the donation result for a chosen option.
 *
 * - `donate`     — entire change goes to donation (cashReturned = 0).
 * - `round_up`   — donate the remainder above the nearest 1.000 (or 100
 *                  when change &lt; 1.000); cashReturned is the rounded
 *                  amount.
 * - `custom`     — donate `customAmount` (clamped to [0, changeAmount]);
 *                  cashReturned is the remainder.
 * - `no_donation`— no donation; cashReturned = changeAmount.
 *
 * `customAmount` is ignored for the non-custom options.
 */
export function calculateDonation(
  changeAmount: bigint,
  option: RoundingOption,
  customAmount: bigint = 0n,
): DonationResult {
  if (changeAmount <= 0n) {
    return {
      choice: { type: option, amount: 0n, description: 'Tidak ada kembalian' },
      originalChange: changeAmount,
      cashReturned: changeAmount,
      donatedAmount: 0n,
    };
  }

  if (option === 'donate') {
    return {
      choice: {
        type: 'donate',
        amount: changeAmount,
        description: `Donasi penuh ${formatRp(changeAmount)}`,
      },
      originalChange: changeAmount,
      cashReturned: 0n,
      donatedAmount: changeAmount,
    };
  }

  if (option === 'round_up') {
    const base = changeAmount >= 1000n ? 1000n : ROUNDING_THRESHOLD;
    const rounded = roundDownToNearest(changeAmount, base);
    const donatedAmount = changeAmount - rounded;

    if (donatedAmount === 0n) {
      return {
        choice: { type: 'round_up', amount: 0n, description: 'Kembalian sudah bulat' },
        originalChange: changeAmount,
        cashReturned: changeAmount,
        donatedAmount: 0n,
      };
    }

    return {
      choice: {
        type: 'round_up',
        amount: donatedAmount,
        description: `Donasi pembulatan ${formatRp(donatedAmount)}`,
      },
      originalChange: changeAmount,
      cashReturned: rounded,
      donatedAmount,
    };
  }

  if (option === 'custom') {
    // Clamp to [0, changeAmount] — the cashier UI should already do
    // this, but defensive math here keeps the JE balanced.
    const clamped = customAmount < 0n ? 0n : customAmount > changeAmount ? changeAmount : customAmount;
    const description =
      clamped === 0n
        ? 'Donasi nominal khusus'
        : `Donasi nominal ${formatRp(clamped)}`;
    return {
      choice: { type: 'custom', amount: clamped, description },
      originalChange: changeAmount,
      cashReturned: changeAmount - clamped,
      donatedAmount: clamped,
    };
  }

  return {
    choice: { type: 'no_donation', amount: 0n, description: 'Tidak berdonasi' },
    originalChange: changeAmount,
    cashReturned: changeAmount,
    donatedAmount: 0n,
  };
}

/**
 * Returns the canonical preset donation options. The `custom` option
 * shows a placeholder result; the UI then renders a numeric input so the
 * cashier can type any amount up to the change.
 */
export function getDonationOptions(changeAmount: bigint): DonationResult[] {
  return (['donate', 'round_up', 'custom', 'no_donation'] as RoundingOption[]).map((option) =>
    calculateDonation(changeAmount, option),
  );
}

function roundDownToNearest(value: bigint, base: bigint): bigint {
  if (value <= 0n) return 0n;
  return (value / base) * base;
}

function formatRp(amount: bigint): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}
