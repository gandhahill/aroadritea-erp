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

// DNS-rebinding guard — must run before any handler.
app.use('*', async (c, next) => {
  const host = (c.req.header('host') ?? '').toLowerCase();
  if (!host || !ALLOWED_HOSTS.has(host)) {
    return c.json({ error: 'forbidden', reason: 'host_not_allowed' }, 403);
  }
  return next();
});

app.get('/healthz', (c) => {
  return c.json({
    status: 'ok',
    service: 'mcp',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (c) => {
  return c.json({
    name: 'aroadri-erp-mcp',
    version: APP_VERSION,
    transport: 'stdio + http',
    healthz: '/healthz',
  });
});

const server = serve({
  fetch: app.fetch,
  hostname: HOST,
  port: PORT,
});

console.info(`[mcp-http] Health server listening on ${HOST}:${PORT}`);
console.info(`[mcp-http] Allowed Host headers: ${[...ALLOWED_HOSTS].join(', ')}`);

export { server };
