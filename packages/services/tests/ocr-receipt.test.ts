import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  aiComplete: vi.fn(),
  createManualSaleDraftTool: vi.fn(async () => ({
    ok: true as const,
    draft_id: 'draft-1',
    expires_at: '2026-05-27T12:00:00.000Z',
    summary: 'Draft penjualan siap dikonfirmasi.',
    requires_confirmation: true as const,
    payload: {},
  })),
}));

vi.mock('../src/ai/client', () => ({
  aiComplete: mocks.aiComplete,
  loadProviderConfig: () => ({
    baseUrl: 'https://ai.example.test/v1',
    apiKey: 'test-key',
    model: 'vision-test',
    reasoningModel: 'vision-test',
    temperature: 0,
    maxTokens: 512,
    supportsVision: true,
  }),
}));

vi.mock('../src/ai/settings', () => ({
  getAiRuntimeConfig: vi.fn(async () => null),
}));

vi.mock('../src/ai/tools/create-manual-sale-draft', () => ({
  createManualSaleDraftTool: mocks.createManualSaleDraftTool,
}));

import { ocrReceiptStrukTool, parseLegacyReceiptText } from '../src/ai/tools/ocr-receipt';

const ctx = { userId: 'u1', tenantId: 'tenant-1', locationId: 'loc-1' };

beforeEach(() => {
  mocks.aiComplete.mockReset();
  mocks.createManualSaleDraftTool.mockClear();
});

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

  it('falls back to local OCR text when the vision provider rejects an upload', async () => {
    mocks.aiComplete.mockRejectedValueOnce(new Error('AI provider responded with 400'));

    const out = await ocrReceiptStrukTool(
      {
        attachment_url: 'data:image/jpeg;base64,aGVsbG8=',
      },
      ctx,
      {
        localOcrText: `
          AROADRI TEA Plaza Malioboro
          Product Sales Report
          Start time:2026-05-26 10:08:24
          End time:2026-05-26 14:07:11
          Total sales:5
          Amount Received:Rp230000
        `,
      },
    );

    expect(out).toMatchObject({
      ok: true,
      draft_id: 'draft-1',
      extracted: {
        sales_date: '2026-05-26',
        gross_sales: '230000',
      },
    });
    expect(mocks.createManualSaleDraftTool).toHaveBeenCalledOnce();
  });
});
