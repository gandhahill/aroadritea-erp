/**
 * Tool: read_file — T-0172 (Phase 3).
 *
 * Bounded file reader so the assistant can quote specific source lines
 * after running `search_codebase`. Shares the same allow-list/deny rules
 * as the search tool to guarantee no `.env*`, `node_modules`, `.git`,
 * `storage`, or build output leaks into responses.
 */

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';

export const ReadFileInputSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(400)
    .regex(/^[A-Za-z0-9._\-\/]+$/, 'path must be repo-relative with safe characters'),
  /** Line where the excerpt starts (default 1). */
  start_line: z.number().int().min(1).max(50_000).optional(),
  /** Number of lines to return (default 80, max 200). */
  line_count: z.number().int().min(1).max(200).optional(),
});

export type ReadFileInput = z.infer<typeof ReadFileInputSchema>;

export interface ReadFileOutput {
  path: string;
  start_line: number;
  end_line: number;
  total_lines: number;
  excerpt: string;
  truncated: boolean;
}

const ALLOW_ROOTS = ['apps', 'packages', 'docs', 'scripts'] as const;
const DENY_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'storage',
  'dist',
  'build',
  'coverage',
  '.code-review-graph',
  '.agents',
  '.claude',
  '.antigravitycli',
  'logs',
]);
const DENY_FILE_PREFIXES = ['.env'];
const MAX_BYTES = 512 * 1024;

function repoRoot(): string {
  return process.env.AROADRI_REPO_ROOT ?? process.cwd();
}

function isAllowedRelativePath(relative: string): boolean {
  if (relative.includes('..')) return false;
  const normalised = relative.replace(/\\/g, '/');
  const parts = normalised.split('/');
  if (parts.length === 0) return false;
  if (!ALLOW_ROOTS.includes(parts[0] as (typeof ALLOW_ROOTS)[number])) return false;
  for (const part of parts) {
    if (DENY_DIR_NAMES.has(part)) return false;
    for (const prefix of DENY_FILE_PREFIXES) {
      if (part.startsWith(prefix)) return false;
    }
  }
  return true;
}

export async function readFileTool(
  input: ReadFileInput,
  _ctx: AuditContext,
): Promise<ReadFileOutput> {
  if (!isAllowedRelativePath(input.path)) {
    throw new Error('path is not within the assistant allow-list');
  }
  const abs = path.resolve(repoRoot(), input.path);
  // Defense-in-depth: ensure the resolved path is still inside repoRoot.
  const root = path.resolve(repoRoot());
  if (!(abs === root || abs.startsWith(`${root}${path.sep}`))) {
    throw new Error('path escapes the repo root');
  }
  const info = await stat(abs);
  if (info.size > MAX_BYTES) {
    throw new Error(`file too large (${info.size} bytes; limit ${MAX_BYTES})`);
  }

  const content = await readFile(abs, 'utf8');
  const lines = content.split(/\r?\n/);
  const total = lines.length;
  const start = Math.max(1, input.start_line ?? 1);
  const count = Math.min(200, input.line_count ?? 80);
  const end = Math.min(total, start + count - 1);
  const slice = lines.slice(start - 1, end).join('\n');

  return {
    path: input.path,
    start_line: start,
    end_line: end,
    total_lines: total,
    excerpt: slice,
    truncated: end < total,
  };
}
