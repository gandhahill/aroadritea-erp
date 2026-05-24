/**
 * Tool: search_codebase — T-0171 (Phase 2).
 *
 * Read-only literal-or-regex search across the allow-listed source
 * directories. Designed to answer "where is feature X implemented?" and
 * "is there a TODO / FIXME blocking my workflow?".
 *
 * Hard guarantees (the assistant gets a tool, not a shell):
 *   - Only files under repo-root / apps / packages / docs / scripts are
 *     read. `..` and absolute paths are rejected.
 *   - `node_modules`, `.git`, `.next`, `storage`, build output, and
 *     anything starting with `.env` are skipped entirely.
 *   - Maximum 25 matches returned, each capped at 500 chars per excerpt.
 *   - Total scan time guarded by a 5 s wall clock; partial results are
 *     returned with `truncated: true` if the budget is exceeded.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';

export const SearchCodebaseInputSchema = z.object({
  query: z.string().min(2).max(120),
  file_glob: z
    .string()
    .max(20)
    .regex(/^\.?[A-Za-z0-9._-]*$/)
    .optional(),
  max_results: z.number().int().min(1).max(25).optional(),
});

export type SearchCodebaseInput = z.infer<typeof SearchCodebaseInputSchema>;

export interface SearchCodebaseMatch {
  file: string;
  line: number;
  excerpt: string;
}

export interface SearchCodebaseOutput {
  query: string;
  matches: SearchCodebaseMatch[];
  scanned_files: number;
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
  '.code-review-graph',
]);
const DENY_FILE_PREFIXES = ['.env'];
const MAX_FILE_BYTES = 256 * 1024; // skip huge files
const TIME_BUDGET_MS = 5_000;
const DEFAULT_MAX_RESULTS = 10;

function repoRoot(): string {
  return process.env.AROADRI_REPO_ROOT ?? process.cwd();
}

function isAllowedFile(relativePath: string, extFilter: string | undefined): boolean {
  const parts = relativePath.split(path.sep);
  if (parts.length === 0) return false;
  if (!ALLOW_ROOTS.includes(parts[0] as (typeof ALLOW_ROOTS)[number])) return false;
  for (const part of parts) {
    if (DENY_DIR_NAMES.has(part)) return false;
    for (const prefix of DENY_FILE_PREFIXES) {
      if (part.startsWith(prefix)) return false;
    }
  }
  if (extFilter) {
    const normalised = extFilter.startsWith('.') ? extFilter : `.${extFilter}`;
    if (!relativePath.toLowerCase().endsWith(normalised.toLowerCase())) return false;
  }
  return true;
}

function buildRegex(query: string): RegExp {
  // Escape special chars by default to give literal substring matching,
  // unless the query is wrapped in /…/ which is the model's signal to
  // pass it as a real regex.
  const trimmed = query.trim();
  if (trimmed.startsWith('/') && trimmed.endsWith('/') && trimmed.length > 2) {
    return new RegExp(trimmed.slice(1, -1), 'i');
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
}

async function walk(
  dir: string,
  relative: string,
  visit: (relativePath: string) => Promise<void>,
  deadline: number,
): Promise<void> {
  if (Date.now() > deadline) return;
  let entries: import('node:fs').Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (Date.now() > deadline) return;
    if (DENY_DIR_NAMES.has(entry.name)) continue;
    if (entry.name.startsWith('.')) {
      // Allow only specific dotted entries (none right now) — skip the
      // rest, including .git, .next, .env*, etc.
      continue;
    }
    const childRel = path.join(relative, entry.name);
    const childAbs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(childAbs, childRel, visit, deadline);
    } else if (entry.isFile()) {
      await visit(childRel);
    }
  }
}

export async function searchCodebaseTool(
  input: SearchCodebaseInput,
  _ctx: AuditContext,
): Promise<SearchCodebaseOutput> {
  const root = path.resolve(repoRoot());
  const maxResults = input.max_results ?? DEFAULT_MAX_RESULTS;
  const regex = buildRegex(input.query);
  const matches: SearchCodebaseMatch[] = [];
  let scanned = 0;
  let truncated = false;
  const deadline = Date.now() + TIME_BUDGET_MS;

  for (const top of ALLOW_ROOTS) {
    if (matches.length >= maxResults) break;
    if (Date.now() > deadline) {
      truncated = true;
      break;
    }
    const startDir = path.join(root, top);
    try {
      const info = await stat(startDir);
      if (!info.isDirectory()) continue;
    } catch {
      continue;
    }
    await walk(
      startDir,
      top,
      async (relativePath) => {
        if (matches.length >= maxResults) return;
        if (!isAllowedFile(relativePath, input.file_glob)) return;
        const abs = path.join(root, relativePath);
        let info;
        try {
          info = await stat(abs);
        } catch {
          return;
        }
        if (info.size > MAX_FILE_BYTES) return;
        scanned += 1;
        let content: string;
        try {
          content = await readFile(abs, 'utf8');
        } catch {
          return;
        }
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          if (matches.length >= maxResults) break;
          const line = lines[i] ?? '';
          if (regex.test(line)) {
            matches.push({
              file: relativePath.replace(/\\/g, '/'),
              line: i + 1,
              excerpt: line.trim().slice(0, 500),
            });
          }
        }
      },
      deadline,
    );
  }

  if (Date.now() > deadline) truncated = true;
  return {
    query: input.query,
    matches,
    scanned_files: scanned,
    truncated,
  };
}
