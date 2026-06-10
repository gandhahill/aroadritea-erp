# Runbook: Public API onboarding (third parties)

How an external integrator (accountant, aggregator, partner) connects to the
Aroadri Tea ERP public REST API. See ADR-0017 for the design.

## 1. Base URL & docs

- **Base URL**: `https://mcp.erp.aroadritea.com` (production). Locally:
  `http://127.0.0.1:3002`.
- **Interactive docs (Scalar)**: `GET /docs`.
- **OpenAPI spec**: `GET /api/v1/openapi.json` (OpenAPI 3.1; import into Postman,
  Insomnia, or any codegen).

## 2. Get a token

API tokens are issued by an ERP admin in **Settings → API Token** (the same
tokens used by the MCP server). A token carries the scope of the issuing user:
the API enforces the exact same permissions as the ERP UI. Ask the admin for a
token whose user holds the permissions you need (e.g. `inventory.view`,
`reporting.view`).

Token format: `aroadri_<env>_<base64url>`. **Treat it as a secret** — it is shown
once at creation and stored only as a SHA-256 hash. Rotate by revoking + reissuing.

## 3. Authentication

Send the token as a Bearer header on every request:

```
Authorization: Bearer aroadri_production_xxxxxxxx
```

## 4. Endpoints (v1, read-only)

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/api/v1/products` | `inventory.view` | Paginated active products. Query: `page`, `pageSize` (≤200), `search`, `categoryId`. |
| GET | `/api/v1/stock?locationId=` | `inventory.view` (location-scoped) | Stock levels at a location. Query: `productId`, `page`, `pageSize`. |
| GET | `/api/v1/reports/daily-summary?locationId=&date=YYYY-MM-DD` | `reporting.view` | Single-day sales summary (WIB). |

Example:

```bash
curl -s https://mcp.erp.aroadritea.com/api/v1/products?pageSize=20 \
  -H "Authorization: Bearer $TOKEN"
```

Paginated responses: `{ "data": [...], "page": 1, "pageSize": 50, "total": 123 }`.

Monetary amounts are **integer strings** in Rupiah (e.g. `"10000"` = Rp10.000) to
preserve precision — do not parse as floats.

## 5. Errors

Uniform envelope with stable machine-readable codes:

```json
{ "error": { "code": "FORBIDDEN", "message": "Permission denied: inventory.view" } }
```

| HTTP | code | Meaning |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Missing/invalid query parameter. |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired token. |
| 403 | `FORBIDDEN` | Token's user lacks the permission. |
| 429 | `RATE_LIMITED` | Over the rate limit; honor `Retry-After` (seconds). |
| 500 | `INTERNAL` | Unexpected server error (no internals leaked). |

## 6. Rate limit

Default **120 requests/minute per token** (fixed window). On `429`, wait the
seconds in the `Retry-After` header before retrying.

## 7. Versioning

The path is versioned (`/api/v1`). Breaking changes ship under a new version;
the current version stays available during a deprecation window announced to
integrators.

## 8. Roadmap (not yet available)

Planned for later F8 cards: more read endpoints (journals, invoices, purchase
orders, financial statements, XLSX exports) and selected idempotent mutations
(draft PO, complaints, member registration, draft journals) — all approval-aware
and requiring an `Idempotency-Key` header.
