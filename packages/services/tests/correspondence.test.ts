import { describe, expect, it } from 'vitest';
import {
  CreateCorrespondenceInputSchema,
  ListCorrespondenceInputSchema,
} from '../src/correspondence';

describe('correspondence schemas', () => {
  it('accepts a valid incoming letter register entry', () => {
    const parsed = CreateCorrespondenceInputSchema.safeParse({
      locationId: 'loc-mli',
      direction: 'incoming',
      documentNo: 'IN-2026-05-001',
      subject: 'Surat penawaran supplier',
      counterparty: 'Supplier A',
      documentDate: '2026-05-21',
      dueDate: '2026-05-28',
      channel: 'email',
      classification: 'procurement',
      priority: 'normal',
      tags: ['supplier', 'procurement'],
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects invalid dates and unsupported statuses', () => {
    const createParsed = CreateCorrespondenceInputSchema.safeParse({
      locationId: 'loc-mli',
      direction: 'incoming',
      documentNo: 'IN-1',
      subject: 'Bad date',
      documentDate: '21-05-2026',
    });
    const listParsed = ListCorrespondenceInputSchema.safeParse({ status: 'deleted' });

    expect(createParsed.success).toBe(false);
    expect(listParsed.success).toBe(false);
  });
});
