/**
 * MCP Server — Aroadri Tea ERP MCP Server.
 * SD §16: stdio transport for CLI clients, token auth via MCP_TOKEN env.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  PingRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import { verifyToken } from './auth';
import type { McpContext } from './context';
import { mcpError } from './helpers';
import {
  accountingTools,
  auditTools,
  crmTools,
  disciplinaryTools,
  hrTools,
  iamTools,
  inventoryTools,
  memberTools,
  payrollTools,
  posTools,
  promotionTools,
  purchasingTools,
  reportingTools,
  taxTools,
} from './tools/index';

const SERVER_INFO = {
  name: 'aroadri-erp',
  version: '1.0.0',
} as const;

// Collect all tools — each module exports typed tool arrays; we compose them
// using a typed helper to preserve the element type. Cast through `unknown` to
// bridge readonly → mutable and the Zod-specific handler type differences.
type ToolEntry = {
  name: string;
  schema: z.ZodTypeAny;
  handler: (input: unknown, ctx: McpContext) => Promise<{ content: unknown[]; isError: boolean }>;
  description?: string;
};
const allTools: ToolEntry[] = [
  ...(iamTools as unknown as ToolEntry[]),
  ...(accountingTools as unknown as ToolEntry[]),
  ...(taxTools as unknown as ToolEntry[]),
  ...(reportingTools as unknown as ToolEntry[]),
  ...(inventoryTools as unknown as ToolEntry[]),
  ...(purchasingTools as unknown as ToolEntry[]),
  ...(posTools as unknown as ToolEntry[]),
  ...(hrTools as unknown as ToolEntry[]),
  ...(payrollTools as unknown as ToolEntry[]),
  ...(disciplinaryTools as unknown as ToolEntry[]),
  ...(crmTools as unknown as ToolEntry[]),
  ...(memberTools as unknown as ToolEntry[]),
  ...(promotionTools as unknown as ToolEntry[]),
  ...(auditTools as unknown as ToolEntry[]),
];

// Tool map for O(1) lookup
const toolMap = new Map<string, (typeof allTools)[number]>(allTools.map((t) => [t.name, t]));

const server = new Server(SERVER_INFO, {
  capabilities: { tools: {} },
  instructions: [
    'Aroadri Tea ERP MCP Server — access accounting, tax, reporting, and more.',
    'Set MCP_TOKEN environment variable to authenticate.',
    'Token: aroadri_<env>_<base64url> — obtain from ERP admin.',
  ].join(' '),
});

// --- ListTools ---

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = allTools.map((tool) => {
    const schema = tool.schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, fieldSchema] of Object.entries(shape)) {
      const zField = fieldSchema as z.ZodTypeAny;
      const isOpt = zField.isOptional ? zField.isOptional() : false;
      if (!isOpt) required.push(key);

      const fieldStr = String(zField);
      if (fieldStr.includes('ZodEnum')) {
        const match = fieldStr.match(/\[(.*?)\]/);
        if (match) {
          const enumValues = match[1] ?? '';
          properties[key] = {
            type: 'string',
            enum: enumValues.split(',').map((v: string) => v.trim().replace(/['"]/g, '')),
          };
        } else {
          properties[key] = { type: 'string' };
        }
      } else if (fieldStr.includes('ZodString')) {
        properties[key] = { type: 'string' };
      } else if (fieldStr.includes('ZodNumber')) {
        properties[key] = { type: 'number' };
      } else if (fieldStr.includes('ZodBoolean')) {
        properties[key] = { type: 'boolean' };
      } else {
        properties[key] = { type: 'string' };
      }
    }

    return {
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
    };
  });

  return { tools };
});

// --- CallTool ---

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const input = request.params.arguments ?? {};

  const tool = toolMap.get(toolName);
  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
      isError: true,
    };
  }

  // Auth
  const token = process.env.MCP_TOKEN;
  if (!token) {
    return {
      content: [
        {
          type: 'text',
          text: '[UNAUTHENTICATED] MCP_TOKEN env var not set. Set it to your API token.',
        },
      ],
      isError: true,
    };
  }

  const user = await verifyToken(token);
  if (!user) {
    return {
      content: [{ type: 'text', text: '[UNAUTHENTICATED] Invalid or expired API token.' }],
      isError: true,
    };
  }

  const ctx: McpContext = {
    userId: user.userId,
    tenantId: user.tenantId,
    locale: user.locale,
  };

  // Validate input
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    return {
      content: [{ type: 'text', text: `[VALIDATION_ERROR] ${errors}` }],
      isError: true,
    };
  }

  // Execute — handler expects the specific inferred type
  try {
    return await tool.handler(parsed.data, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return mcpError('INTERNAL', `Unhandled error in ${toolName}: ${msg}`);
  }
});

// --- Ping ---

server.setRequestHandler(PingRequestSchema, async () => ({}));

// --- Start HTTP health server ---
import { server as httpServer } from './http-server';
void httpServer;

// --- Start stdio MCP server ---

if (process.env.MCP_ENABLE_STDIO !== 'false') {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.info(`MCP server connected — ${allTools.length} tools available`, {
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
  });
} else {
  console.info('MCP stdio transport disabled — HTTP health server only', {
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    tools: allTools.length,
  });
}
