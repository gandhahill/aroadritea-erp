# T-0198: Fix read_file tool invalidArguments due to regex and path

## Status
🟩 DONE

## Owner
Antigravity

## Started
2026-05-27 17:44 WIB

## Last Updated
2026-05-27 17:46 WIB

## Goal
The user pointed out that `read_file` tool repeatedly failed with `ai.tool.invalidArguments` when trying to read `apps/web/app/(dash)/docs/docs-content.ts` (found via search_codebase).
This was caused by the Zod schema for the `path` argument containing a regex `/^[A-Za-z0-9._\-\/]+$/` that did not allow parentheses `()` — which are required for Next.js App Router route groups like `(dash)`.
Additionally, `read_file` had the same `repoRoot() = process.cwd()` bug as `search_codebase`, which would cause it to search `apps/web/apps/web/...` at runtime.

## Progress
- [x] Updated Zod regex in `packages/services/src/ai/tools/read-file.ts` to allow `()`.
- [x] Updated `repoRoot()` to use `path.resolve(__dirname, '../../../../..')` using `import.meta.url`.
- [x] Tested with `pnpm test tests/ai-lookup-tools.test.ts`.
- [x] Committed and triggered VPS deployment.
