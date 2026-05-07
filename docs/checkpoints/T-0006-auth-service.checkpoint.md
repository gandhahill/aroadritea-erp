# Checkpoint: T-0006 + T-0007 — Auth Service + IAM Permission Engine

**Status**: 🟩 DONE
**Owner**: Antigravity (Opus 4.6)
**Started**: 2026-05-07
**Last Updated**: 2026-05-07
**Completed**: 2026-05-07

## Scope
- T-0006: Service `auth` (better-auth integration) + login UI
- T-0007: Service `iam.can()` permission engine + cache + tests

## Plan
1. Schema: Add `emailVerified` to users + `api_tokens` table
2. Install deps: `better-auth`, `argon2`
3. Implement auth server + client in `packages/services/src/auth/`
4. Implement IAM permission engine in `packages/services/src/iam/`
5. Create API route, middleware, wire login page
6. Seed dev admin user
7. Tests + verification

## Progress
- [x] Schema additions (`emailVerified` on users, `api_tokens` table)
- [x] Dependencies installed (`better-auth@^1.6.9`, `argon2@^0.44.0`)
- [x] Auth service implemented (`auth.server.ts`, `auth.client.ts`, `password.ts`)
- [x] IAM permission engine implemented (`permission-engine.ts`, `require-permission.ts`)
- [x] API route (`/api/auth/[...all]`) + middleware (session cookie check)
- [x] Login page wired (`apps/web/app/(auth)/login/page.tsx` — branded, i18n)
- [x] Dashboard layout with session guard + suspended user redirect
- [x] Seed admin user (`admin@aroadritea.com`, director role, global scope)
- [x] Tests pass (17 IAM permission tests + 58 shared tests)
- [x] TypeScript typecheck passes (zero errors)
- [x] Dev server starts and login page renders correctly

## Files Created/Modified

### `packages/db/schema/auth.ts`
- Users table with `emailVerified` column
- `apiTokens` table for MCP server auth (SHA-256 hashed)
- All relations defined

### `packages/services/src/auth/`
- `auth.server.ts`: better-auth config with Drizzle adapter, argon2id password hashing, session config (7d expiry), cookie prefix `aroadri`
- `auth.client.ts`: createAuthClient for React components
- `password.ts`: argon2id hash/verify (memoryCost 19456 for 2GB constraint)
- `index.ts`: barrel export (password.ts NOT re-exported to avoid Edge bundling issue)

### `packages/services/src/iam/`
- `permission-engine.ts`: `can()` function with 60s in-memory cache, wildcard support (`*.*`, `module.*`), location-scoped roles
- `require-permission.ts`: Result-typed wrapper for service functions
- `index.ts`: barrel export

### `apps/web/`
- `app/api/auth/[...all]/route.ts`: better-auth Next.js handler
- `app/(auth)/login/page.tsx`: branded login UI with i18n, error handling, password toggle
- `app/(dash)/layout.tsx`: session guard, suspended user redirect
- `middleware.ts`: session cookie check, public paths whitelist
- `lib/auth.ts`: getSession/requireSession helpers
- `lib/auth-client.ts`: re-export client auth functions

### `packages/db/seed/`
- `iam.ts`: tenant, 4 locations, 7 roles, 40+ permissions, role-permission mapping, dev admin user
- `index.ts`: seed runner with admin user creation (argon2id hashed)

## Verification
- `pnpm --filter @erp/services exec vitest run` → 17 tests passed
- `pnpm --filter @erp/shared test` → 58 tests passed  
- `pnpm --filter @erp/web exec tsc --noEmit` → 0 errors
- `pnpm --filter @erp/web dev` → server starts, login page renders at localhost:3000/login
