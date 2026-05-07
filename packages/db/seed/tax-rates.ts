/**
 * Tax rate seed data — SD §19.1, §19.3.2
 *
 * Seed tarif: PB1, PPN_OUT, PPN_IN, PPH21, PPH23, PPH25
 * Posting account IDs reference COA codes (resolved at seed time).
 *
 * NOTE: These use COA codes (not IDs) because IDs are generated at seed time.
 * The seed runner resolves codes → IDs before inserting.
 */

/**
 * Tax rate seed entries.
 * `postingAccountCode` is resolved to `postingAccountId` at seed time.
 */
export const TAX_RATES_SEED = [
  {
    code: 'PB1',
    name: {
      id: 'Pajak Restoran / PBJT (10%)',
      en: 'Restaurant Tax / PB1 (10%)',
      zh: '餐饮税 PB1 (10%)',
    },
    rateBps: 1000, // 10%
    calculation: 'inclusive' as const,
    postingAccountCode: '2-1050', // PB1/PBJT Payable
    isActive: true,
    effectiveFrom: '2024-01-01',
  },
  {
    code: 'PPN_OUT',
    name: {
      id: 'PPN Keluaran (11%)',
      en: 'VAT Out (11%)',
      zh: '销项增值税 (11%)',
    },
    rateBps: 1100, // 11%
    calculation: 'exclusive' as const,
    postingAccountCode: '2-1110', // PPN Keluaran (Vat Out)
    isActive: true,
    effectiveFrom: '2024-01-01',
  },
  {
    code: 'PPN_IN',
    name: {
      id: 'PPN Masukan (11%)',
      en: 'VAT In (11%)',
      zh: '进项增值税 (11%)',
    },
    rateBps: 1100, // 11%
    calculation: 'exclusive' as const,
    postingAccountCode: '1-1640', // PPN Masukan (Vat In)
    isActive: true,
    effectiveFrom: '2024-01-01',
  },
  {
    code: 'PPH21',
    name: {
      id: 'PPh Pasal 21 (Tarif Progresif)',
      en: 'Income Tax Art. 21 (Progressive)',
      zh: '第21条所得税（累进税率）',
    },
    rateBps: 500, // 5% base bracket — actual calculation uses TER brackets
    calculation: 'exclusive' as const,
    postingAccountCode: '2-1070', // Final Income Tax Payable
    isActive: true,
    effectiveFrom: '2024-01-01',
  },
  {
    code: 'PPH23',
    name: {
      id: 'PPh Pasal 23 (2%)',
      en: 'Income Tax Art. 23 (2%)',
      zh: '第23条所得税 (2%)',
    },
    rateBps: 200, // 2%
    calculation: 'exclusive' as const,
    postingAccountCode: '2-1080', // PPh 23 Payable
    isActive: true,
    effectiveFrom: '2024-01-01',
  },
  {
    code: 'PPH25',
    name: {
      id: 'PPh Pasal 25 (Angsuran Bulanan)',
      en: 'Income Tax Art. 25 (Monthly Installment)',
      zh: '第25条所得税（月度分期）',
    },
    rateBps: 50, // 0.5% (default for UMKM PP 55/2022)
    calculation: 'exclusive' as const,
    postingAccountCode: '1-1610', // Prepaid Final Tax
    isActive: true,
    effectiveFrom: '2024-01-01',
  },
] as const;
