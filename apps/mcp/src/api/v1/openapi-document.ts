/**
 * OpenAPI 3.1 document for the Aroadri Tea public REST API (v1).
 *
 * The spec is defined in code so it ships with the server and stays in lockstep
 * with the route handlers in `./index.ts`. (We hand-author the document rather
 * than generate it via `@hono/zod-openapi` to avoid that package's zod v3 peer
 * dependency — the workspace is pinned to zod v4. See ADR-0017.)
 */

export function buildOpenApiDocument(serverUrl: string): Record<string, unknown> {
  const errorResponse = {
    description: 'Error',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
      },
    },
  };

  const pageParams = [
    {
      name: 'page',
      in: 'query',
      required: false,
      schema: { type: 'integer', minimum: 1, default: 1 },
      description: '1-based page number.',
    },
    {
      name: 'pageSize',
      in: 'query',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      description: 'Items per page (max 200).',
    },
  ];

  return {
    openapi: '3.1.0',
    info: {
      title: 'Aroadri Tea ERP — Public API',
      version: '1.0.0',
      description: [
        'Read-only REST API for third-party integrators (external accountants,',
        'aggregators, partners). Authenticate with a Bearer API token issued by',
        'an ERP admin (Settings → API Token). All endpoints enforce the same',
        'permission engine and audit log as the ERP UI.',
        '',
        'Rate limit: 120 requests/minute per token. Responses use stable error',
        'codes. Monetary amounts are returned as strings (smallest currency unit,',
        'Rupiah) to preserve precision.',
      ].join('\n'),
    },
    servers: [{ url: serverUrl, description: 'Aroadri Tea ERP API' }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Inventory', description: 'Products and stock levels.' },
      { name: 'Reports', description: 'Operational and financial reports.' },
    ],
    paths: {
      '/api/v1/products': {
        get: {
          tags: ['Inventory'],
          summary: 'List products',
          description: 'Paginated list of active products. Requires `inventory.view`.',
          operationId: 'listProducts',
          parameters: [
            ...pageParams,
            {
              name: 'search',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Free-text filter on product name/SKU.',
            },
            {
              name: 'categoryId',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Filter by category id.',
            },
          ],
          responses: {
            '200': {
              description: 'A page of products.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ProductPage' },
                },
              },
            },
            '401': errorResponse,
            '403': errorResponse,
            '429': errorResponse,
          },
        },
      },
      '/api/v1/stock': {
        get: {
          tags: ['Inventory'],
          summary: 'List stock levels',
          description: 'Stock levels at a location. Requires `inventory.view` for that location.',
          operationId: 'listStock',
          parameters: [
            {
              name: 'locationId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Location id to read stock for.',
            },
            {
              name: 'productId',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Optional single-product filter.',
            },
            ...pageParams,
          ],
          responses: {
            '200': {
              description: 'A page of stock levels.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/StockPage' },
                },
              },
            },
            '400': errorResponse,
            '401': errorResponse,
            '403': errorResponse,
            '429': errorResponse,
          },
        },
      },
      '/api/v1/reports/daily-summary': {
        get: {
          tags: ['Reports'],
          summary: 'Daily sales summary',
          description: 'Sales summary for a single day at a location. Requires `reporting.view`.',
          operationId: 'getDailySummary',
          parameters: [
            {
              name: 'locationId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'date',
              in: 'query',
              required: true,
              schema: { type: 'string', format: 'date' },
              description: 'Day to summarize (YYYY-MM-DD, WIB).',
            },
          ],
          responses: {
            '200': {
              description: 'The daily summary.',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            '400': errorResponse,
            '401': errorResponse,
            '403': errorResponse,
            '429': errorResponse,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API token: `aroadri_<env>_<base64url>`. Obtain from an ERP admin.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  description: 'Stable machine-readable code.',
                  examples: ['UNAUTHENTICATED', 'FORBIDDEN', 'RATE_LIMITED', 'VALIDATION_ERROR'],
                },
                message: { type: 'string' },
              },
            },
          },
        },
        LocaleString: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            en: { type: 'string' },
            zh: { type: 'string' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            sku: { type: 'string' },
            name: { $ref: '#/components/schemas/LocaleString' },
            categoryCode: { type: 'string' },
            categoryName: { $ref: '#/components/schemas/LocaleString' },
            imageUrl: { type: ['string', 'null'] },
            variantPriceMin: {
              type: ['string', 'null'],
              description: 'Cheapest active variant price (Rupiah, integer string).',
            },
            variantPriceMax: { type: ['string', 'null'] },
          },
        },
        ProductPage: {
          type: 'object',
          required: ['data', 'page', 'pageSize', 'total'],
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            total: { type: 'integer' },
          },
        },
        StockPage: {
          type: 'object',
          required: ['data', 'page', 'pageSize', 'total'],
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            total: { type: 'integer' },
          },
        },
      },
    },
  };
}
