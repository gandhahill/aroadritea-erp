/**
 * HTTP health server for MCP — Aroadri Tea ERP.
 * Runs alongside the MCP stdio server on a separate port.
 * SD §35.1.5, §28.2: lightweight healthz check (no DB, no auth).
 *
 * Security hardening — DNS rebinding:
 * Even though this server only exposes /healthz and / (no MCP tool
 * surface), we still validate the `Host` request header to defend
 * against DNS-rebinding attacks that target localhost services. A
 * malicious page in the operator's browser could otherwise resolve a
 * controlled hostname to 127.0.0.1 and call this endpoint. The
 * allow-list is configurable via MCP_HTTP_ALLOWED_HOSTS (comma-
 * separated). See MCP SDK advisory (DNS rebinding protection) and
 * the MCP security best practices.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { SCALAR_CSP, renderScalarDocs } from './api/docs';
import { apiV1, buildOpenApiDocument } from './api/v1';

const APP_VERSION = process.env.npm_package_version ?? '0.1.0';
const HOST = process.env.MCP_HTTP_HOST ?? '127.0.0.1';
const PORT = Number.parseInt(process.env.MCP_HTTP_PORT ?? '3002', 10);

/**
 * Default allow-list: localhost variants on the bound port. Extend with
 * the public hostname (e.g. mcp.aroadritea.com) via MCP_HTTP_ALLOWED_HOSTS
 * when fronted by a reverse proxy.
 */
const DEFAULT_ALLOWED = [
  `${HOST}:${PORT}`,
  `localhost:${PORT}`,
  `127.0.0.1:${PORT}`,
  `[::1]:${PORT}`,
];

function hostFromPublicUrl(value: string | undefined): string[] {
  if (!value) return [];

  try {
    const url = new URL(value);
    return [url.host.toLowerCase()].filter(Boolean);
  } catch {
    return [];
  }
}

const PUBLIC_ALLOWED = [
  ...hostFromPublicUrl(process.env.MCP_SERVER_URL),
  ...hostFromPublicUrl(process.env.NEXT_PUBLIC_WEB_URL),
  ...hostFromPublicUrl(process.env.BETTER_AUTH_URL),
];

const ALLOWED_HOSTS = new Set(
  (process.env.MCP_HTTP_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .concat(
      DEFAULT_ALLOWED.map((s) => s.toLowerCase()),
      PUBLIC_ALLOWED,
    ),
);

const app = new Hono();

app.use('*', async (c, next) => {
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '0');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Cross-Origin-Resource-Policy', 'same-origin');
  c.header('Cache-Control', 'no-store');
  return next();
});

// DNS-rebinding guard — must run before any handler.
app.use('*', async (c, next) => {
  const host = (c.req.header('host') ?? '').toLowerCase();
  if (!host || !ALLOWED_HOSTS.has(host)) {
    return c.json({ error: 'forbidden', reason: 'host_not_allowed' }, 403);
  }
  return next();
});

app.get('/healthz', (c) => {
  const detailToken = process.env.HEALTHZ_DETAIL_TOKEN;
  if (detailToken && c.req.header('x-healthz-token') === detailToken) {
    return c.json({ status: 'ok', service: 'mcp', version: APP_VERSION });
  }
  return c.json({ status: 'ok' });
});

app.get('/', (c) => {
  return c.json({ status: 'ok' });
});

// ─── Public REST API (v1) + Scalar docs ──────────────────────────────────────
// The OpenAPI spec and the Scalar docs page are public (no auth); the actual
// API routes under /api/v1 enforce Bearer auth + permissions. When fronted by a
// reverse proxy, set MCP_SERVER_URL (and MCP_HTTP_ALLOWED_HOSTS) to the public
// API host so the spec advertises the right server and the Host guard allows it.
const PUBLIC_API_BASE = process.env.MCP_SERVER_URL ?? `http://${HOST}:${PORT}`;

// Registered before the /api/v1 mount so this exact path stays unauthenticated.
app.get('/api/v1/openapi.json', (c) => c.json(buildOpenApiDocument(PUBLIC_API_BASE)));

app.get('/docs', (c) => {
  c.header('Content-Security-Policy', SCALAR_CSP);
  c.header('Cache-Control', 'no-store');
  return c.html(renderScalarDocs('/api/v1/openapi.json'));
});

app.route('/api/v1', apiV1);

const server = serve({
  fetch: app.fetch,
  hostname: HOST,
  port: PORT,
});

console.info(`[mcp-http] Health server listening on ${HOST}:${PORT}`);
console.info(`[mcp-http] Allowed Host headers: ${[...ALLOWED_HOSTS].join(', ')}`);

export { server };
