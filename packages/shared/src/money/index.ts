export type Money = bigint;

export const rupiah = (n: number | string): Money =>
  BigInt(typeof n === 'string' ? n.replace(/\D/g, '') : Math.round(n));

export const formatRupiah = (m: Money, locale = 'id-ID'): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(m));

export const ZERO: Money = 0n;

export const add = (a: Money, b: Money): Money => a + b;
export const subtract = (a: Money, b: Money): Money => a - b;
