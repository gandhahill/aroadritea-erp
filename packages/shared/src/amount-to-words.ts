/**
 * shared/amount-to-words.ts
 *
 * Converts a numeric amount to Indonesian terbilang text.
 * Example: 3_500_000 → "Tiga Juta Lima Ratus Ribu Rupiah"
 */

const SATUAN = [
  '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima',
  'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh',
  'Sebelas',
];

function terbilangHelper(n: number): string {
  if (n < 12) return SATUAN[n]!;
  if (n < 20) return `${SATUAN[n - 10]} Belas`;
  if (n < 100) return `${SATUAN[Math.floor(n / 10)]} Puluh${n % 10 ? ` ${SATUAN[n % 10]}` : ''}`;
  if (n < 200) return `Seratus${n - 100 ? ` ${terbilangHelper(n - 100)}` : ''}`;
  if (n < 1_000) return `${SATUAN[Math.floor(n / 100)]} Ratus${n % 100 ? ` ${terbilangHelper(n % 100)}` : ''}`;
  if (n < 2_000) return `Seribu${n - 1_000 ? ` ${terbilangHelper(n - 1_000)}` : ''}`;
  if (n < 1_000_000) return `${terbilangHelper(Math.floor(n / 1_000))} Ribu${n % 1_000 ? ` ${terbilangHelper(n % 1_000)}` : ''}`;
  if (n < 1_000_000_000) return `${terbilangHelper(Math.floor(n / 1_000_000))} Juta${n % 1_000_000 ? ` ${terbilangHelper(n % 1_000_000)}` : ''}`;
  if (n < 1_000_000_000_000) return `${terbilangHelper(Math.floor(n / 1_000_000_000))} Miliar${n % 1_000_000_000 ? ` ${terbilangHelper(n % 1_000_000_000)}` : ''}`;
  return `${terbilangHelper(Math.floor(n / 1_000_000_000_000))} Triliun${n % 1_000_000_000_000 ? ` ${terbilangHelper(n % 1_000_000_000_000)}` : ''}`;
}

/**
 * Convert a numeric amount to Indonesian terbilang.
 * @param amount - The amount (number or bigint or string).
 * @returns Terbilang string ending with "Rupiah".
 */
export function amountToWords(amount: number | bigint | string): string {
  const num = typeof amount === 'bigint' ? Number(amount) : Number(amount);
  if (Number.isNaN(num) || num < 0) return '';
  if (num === 0) return 'Nol Rupiah';
  return `${terbilangHelper(Math.floor(num)).trim()} Rupiah`;
}
