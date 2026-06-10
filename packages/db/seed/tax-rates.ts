/**
 * Tax rate seed data — SD §19.1, §19.3.2
 *
 * Seed tarif: PB1, PPN_OUT, PPN_IN, PPH21, PPH23, PPH25, PPH_FINAL_UMKM
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
    postingAccountCode: '2-1500', // PB1/PBJT Payable
    isActive: true,
    effectiveFrom: '2024-01-01',
  },
  {
    code: 'PPN_OUT',
    name: {
      id: 'PPN Keluaran (efektif 11%)',
      en: 'VAT Out (effective 11%)',
      zh: '销项增值税 (11%)',
    },
    // Current non-lux VAT uses the 11% effective rate. From 2025 this is
    // statutory 12% multiplied by deemed DPP 11/12 under PMK 131/2024.
    rateBps: 1100,
    calculation: 'exclusive' as const,
    postingAccountCode: '2-2300', // PPN Keluaran (Vat Out)
    isActive: true,
    effectiveFrom: '2024-01-01',
  },
  {
    code: 'PPN_IN',
    name: {
      id: 'PPN Masukan (efektif 11%)',
      en: 'VAT In (effective 11%)',
      zh: '进项增值税 (11%)',
    },
    // Keep the effective 11% rate for ordinary non-luxury input VAT.
    rateBps: 1100,
    calculation: 'exclusive' as const,
    postingAccountCode: '1-4100', // PPN Masukan (Vat In)
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
    postingAccountCode: '2-1300', // Income Tax Payable
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
    postingAccountCode: '2-1800', // PPh 23 Payable
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
    // PPh 25 is an installment amount derived from annual tax, not a fixed rate.
    // The 0.5% final UMKM rate is seeded separately as PPH_FINAL_UMKM.
    rateBps: 0,
    calculation: 'exclusive' as const,
    postingAccountCode: '1-2600', // Prepaid Final Tax
    isActive: true,
    effectiveFrom: '2024-01-01',
  },
  {
    code: 'PPH_FINAL_UMKM',
    name: {
      id: 'PPh Final UMKM (0,5%)',
      en: 'Final MSME Income Tax (0.5%)',
      zh: 'Final MSME Income Tax (0.5%)',
    },
    rateBps: 50, // 0.5% of qualifying monthly gross turnover.
    calculation: 'exclusive' as const,
    postingAccountCode: '2-1700', // Final Income Tax Payable
    isActive: true,
    effectiveFrom: '2024-01-01',
  },
] as const;
