import { beforeEach, describe, expect, it, vi } from 'vitest';

interface SelectStep {
  rows: unknown[];
}

let selectQueue: SelectStep[] = [];

function nextSelectRows(): unknown[] {
  return selectQueue.shift()?.rows ?? [];
}

vi.mock('@erp/db', () => {
  const condition = (name: string) => ({ name });
  return {
    db: {
      select: () => ({
        from: () => {
          const chain: {
            where: () => typeof chain;
            limit: () => Promise<unknown[]>;
            then: (resolve: (value: unknown[]) => void) => void;
          } = {
            where: () => chain,
            limit: () => Promise.resolve(nextSelectRows()),
            // biome-ignore lint/suspicious/noThenProperty: Drizzle query builders are thenable.
            then: (resolve) => resolve(nextSelectRows()),
          };
          return chain;
        },
      }),
    },
    and: () => condition('and'),
    eq: () => condition('eq'),
    ilike: () => condition('ilike'),
    inArray: () => condition('inArray'),
    or: () => condition('or'),
    sql: () => condition('sql'),
  };
});

vi.mock('../src/iam', () => ({
  getAuthorizedLocations: vi.fn(async () => ({ scope: 'global', locationIds: [] })),
}));

const ctx = { userId: 'u1', tenantId: 'tenant-1', locationId: 'loc-1' };

beforeEach(() => {
  selectQueue = [];
});

describe('AI lookup tools', () => {
  it('resolves Plaza 1 to the token-matched Plaza Malioboro outlet', async () => {
    selectQueue = [
      { rows: [] },
      {
        rows: [
          {
            id: '01KS6V55AE5MH5S1Z1KE2DE3YK',
            code: 'PLZ',
            name: {
              id: 'Aroadri Tea Plaza Malioboro',
              en: 'Aroadri Tea Plaza Malioboro',
              zh: 'Aroadri Tea Plaza Malioboro',
            },
            type: 'store',
            status: 'active',
          },
        ],
      },
    ];

    const { resolveLocationTool } = await import('../src/ai/tools/resolve-location');
    const out = await resolveLocationTool({ query: 'Plaza 1' }, ctx);

    expect(out).toMatchObject({
      found: true,
      location: { code: 'PLZ' },
    });
  });

  it('finds Osmanthus Oolong Fresh Tea from non-contiguous product words', async () => {
    selectQueue = [
      { rows: [] },
      {
        rows: [
          {
            id: 'prd-ft-osm',
            sku: 'FT-OSM',
            name: {
              id: 'Osmanthus Oolong Fresh Tea',
              en: 'Osmanthus Oolong Fresh Tea',
              zh: '桂花乌龙鲜茶',
            },
            categoryId: 'cat-fresh-tea',
            kind: 'finished_good',
            uom: 'cup',
            isActive: true,
            defaultSellPrice: '32000',
            defaultCostPrice: '0',
          },
        ],
      },
      { rows: [] },
    ];

    const { getProductTool } = await import('../src/ai/tools/get-product');
    const out = await getProductTool({ query: 'osmanthus fresh tea' }, ctx);

    expect(out).toMatchObject({
      found: true,
      product: {
        id: 'prd-ft-osm',
        sku: 'FT-OSM',
        default_sell_price: '32000',
      },
    });
  });
});
