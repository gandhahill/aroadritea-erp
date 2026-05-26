import { describe, expect, it } from 'vitest';
import { parseLegacyReceiptText } from '../src/ai/tools/ocr-receipt';

describe('parseLegacyReceiptText', () => {
  it('extracts Product Sales Report totals from a legacy POS receipt OCR text', () => {
    const text = `
      AROADRI TEA Plaza Malioboro
      Product Sales Report
      cashier:Kevin
      Start time:2026-05-26 10:08:24
      End time:2026-05-26 14:07:11
      Statistical channel:Channels(all)
      Group type:Product Category
      Total sales:5
      Amount Received:Rp230000
    `;

    const parsed = parseLegacyReceiptText(text);
    expect(parsed).toMatchObject({
      sales_date: '2026-05-26',
      channel: 'walk_in',
      payment_method: 'cash',
      gross_sales: '230000',
      transaction_count: 5,
    });
  });

  it('tolerates noisy Tesseract text from the real Plaza Malioboro receipt photo', () => {
    const text = `
      ROADKI TEA Plaza Malio boro
      Product Sales Report
      Cashier:Kevin
      Start time: 2026-()b-26 10:08:24
      End time: 2026-05 -26 14:07:11
      Statistical channel:Channelas (all)
      Group type: Product. Category
      Total sales:6
      Amount. Recei ved: Rp230000
      Name Qty Amount
      (Milk Teal [5] [230000 }
      Osmanthus Oolong Milk Teal 700m1,8 2 94000 /
    `;

    const parsed = parseLegacyReceiptText(text);
    expect(parsed).toMatchObject({
      sales_date: '2026-05-26',
      gross_sales: '230000',
      transaction_count: 5,
    });
  });

  it('returns null when the OCR text has no date or amount', () => {
    expect(parseLegacyReceiptText('unrelated blurry text')).toBeNull();
  });
});
