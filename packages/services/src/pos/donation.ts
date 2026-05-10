/**
 * pos.donation — SD §25.11
 *
 * Handles the donation/rounding choice for POS change.
 *
 * Business logic:
 * - When a customer pays in cash and receives change,
 *   they may choose to donate all or part of the change.
 * - Options:
 *     'donate'      — donate the entire change amount
 *     'round_up'    — round the change up to the nearest Rp 100,
 *                     donate the difference between change and rounded amount
 *     'no_donation' — return exact change, no donation
 * - Rounding only applies when change < Rp 100 (rounding up a large amount makes no sense)
 * - Donation is stored as `donationAmount` (positive bigint) on the cash payment row
 *
 * COA references (SD §25.11.2):
 *   2-2050 Donation Trust Payable (liability/passiva sementara)
 */

import { type Result, ok, err } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RoundingOption = 'donate' | 'round_up' | 'no_donation';

export interface DonationChoice {
  type: RoundingOption;
  /** Donation amount in sen/rupiah (always positive or 0). */
  amount: bigint;
  /** Human-readable description of the choice. */
  description: string;
}

export interface DonationResult {
  choice: DonationChoice;
  /** The change that would be returned if no donation. */
  originalChange: bigint;
  /** The actual cash returned to the customer. */
  cashReturned: bigint;
  /** Amount retained as donation. */
  donatedAmount: bigint;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

/**
 * Rounding threshold: round up to the nearest THRESHOLD sen.
 * e.g., 67 sen → round up to 100 sen, donate 33 sen.
 * Threshold must be a power of 10 (10, 100, 1000, etc.).
 */
const ROUNDING_THRESHOLD = 100n;

// ─── Core calculation ───────────────────────────────────────────────────────────

/**
 * Calculate donation choice based on change amount.
 *
 * - change < THRESHOLD: 'donate' donates all of it
 * - change >= THRESHOLD: 'round_up' rounds to next THRESHOLD, donates the diff
 * - 'no_donation' returns everything
 *
 * Only meaningful for change > 0.
 */
export function calculateDonation(
  changeAmount: bigint,
  option: RoundingOption,
): DonationResult {
  if (changeAmount <= BigInt(0)) {
    return {
      choice: { type: option, amount: BigInt(0), description: 'Tidak ada kembalian' },
      originalChange: changeAmount,
      cashReturned: changeAmount,
      donatedAmount: BigInt(0),
    };
  }

  switch (option) {
    case 'donate': {
      // Donate the entire change; customer receives nothing in cash
      return {
        choice: {
          type: 'donate',
          amount: changeAmount,
          description: `Donasi penuh Rp ${formatRp(changeAmount)}`,
        },
        originalChange: changeAmount,
        cashReturned: BigInt(0),
        donatedAmount: changeAmount,
      };
    }

    case 'round_up': {
      // Round DOWN the change to nearest denomination; customer gets less, remainder donated.
      // e.g., change 4700 → customer gets 4000, donation = 700
      if (changeAmount >= 1000n) {
        const rounded = roundDownToNearest(changeAmount, 1000n);
        const diff = changeAmount - rounded;
        if (diff === BigInt(0)) {
          return {
            choice: {
              type: 'round_up',
              amount: BigInt(0),
              description: 'Kembalian sudah bulat',
            },
            originalChange: changeAmount,
            cashReturned: changeAmount,
            donatedAmount: BigInt(0),
          };
        }
        return {
          choice: {
            type: 'round_up',
            amount: diff,
            description: `Donasi pembulatan Rp ${formatRp(diff)}`,
          },
          originalChange: changeAmount,
          cashReturned: rounded,
          donatedAmount: diff,
        };
      }

      // Small change (< 1000): round down to nearest 100
      const rounded = roundDownToNearest(changeAmount, ROUNDING_THRESHOLD);
      const diff = changeAmount - rounded;
      if (diff === BigInt(0)) {
        return {
          choice: {
            type: 'round_up',
            amount: BigInt(0),
            description: 'Kembalian sudah bulat',
          },
          originalChange: changeAmount,
          cashReturned: changeAmount,
          donatedAmount: BigInt(0),
        };
      }
      return {
        choice: {
          type: 'round_up',
          amount: diff,
          description: `Donasi pembulatan Rp ${formatRp(diff)}`,
        },
        originalChange: changeAmount,
        cashReturned: rounded,
        donatedAmount: diff,
      };
    }

    case 'no_donation':
    default: {
      return {
        choice: {
          type: 'no_donation',
          amount: BigInt(0),
          description: 'Tidak berdonasi',
        },
        originalChange: changeAmount,
        cashReturned: changeAmount,
        donatedAmount: BigInt(0),
      };
    }
  }
}

/**
 * Round n DOWN to the nearest multiple of `base`.
 * e.g., roundDownToNearest(4700, 1000) = 4000, roundDownToNearest(5000, 1000) = 5000
 */
function roundDownToNearest(n: bigint, base: bigint): bigint {
  if (n <= BigInt(0)) return BigInt(0);
  return (n / base) * base;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatRp(amount: bigint): string {
  const num = Number(amount);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Summarize all donation options for a given change amount (for UI display).
 */
export function getDonationOptions(changeAmount: bigint): DonationResult[] {
  return (['donate', 'round_up', 'no_donation'] as RoundingOption[]).map((option) =>
    calculateDonation(changeAmount, option),
  );
}