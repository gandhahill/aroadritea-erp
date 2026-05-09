/**
 * HTTP health server for MCP — Aroadri Tea ERP.
 * Runs alongside the MCP stdio server on a separate port.
 * SD §35.1.5, §28.2: lightweight healthz check (no DB, no auth).
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const APP_VERSION = process.env.npm_package_version ?? '0.1.0';
const PORT = parseInt(process.env.MCP_HTTP_PORT ?? '3002', 10);

const app = new Hono();

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
  port: PORT,
});

console.info(`[mcp-http] Health server listening on port ${PORT}`);

export { server };
