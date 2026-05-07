# Checkpoint: T-0006 + T-0007 — Auth Service + IAM Permission Engine

**Status**: 🟨 IN_PROGRESS
**Owner**: Antigravity (Opus 4.6)
**Started**: 2026-05-07
**Last Updated**: 2026-05-07

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
- [ ] Schema additions
- [ ] Dependencies installed
- [ ] Auth service implemented
- [ ] IAM permission engine implemented
- [ ] API route + middleware
- [ ] Login page wired
- [ ] Dashboard layout
- [ ] Seed admin user
- [ ] Tests pass

## Next step
Starting with schema additions and dependency installation.
