'use client';

export type RoundingOption = 'donate' | 'round_up' | 'no_donation';

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

export function calculateDonation(changeAmount: bigint, option: RoundingOption): DonationResult {
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

  return {
    choice: { type: 'no_donation', amount: 0n, description: 'Tidak berdonasi' },
    originalChange: changeAmount,
    cashReturned: changeAmount,
    donatedAmount: 0n,
  };
}

export function getDonationOptions(changeAmount: bigint): DonationResult[] {
  return (['donate', 'round_up', 'no_donation'] as RoundingOption[]).map((option) =>
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
