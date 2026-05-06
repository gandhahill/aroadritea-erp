import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();

app.get('/healthz', (c) => c.json({ status: 'ok' }));

const port = Number(process.env.MCP_PORT) || 3002;

serve({ fetch: app.fetch, port }, () => {
  console.info(`MCP server running on port ${port}`);
});

export default app;
