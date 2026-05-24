# Checkpoint: T-0170 — Audit 26-Dimensi & Direct Fix

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-24 15:30 WIB
- **Last updated**: 2026-05-24 15:35 WIB
- **Status**: 🟨 IN_PROGRESS
- **Phase**: Cross-cutting comprehensive audit
- **Branch**: master

## Goal

Audit menyeluruh codebase Aroadri Tea ERP pada **26 dimensi** (A-correctness, B-security, C-architecture, D-UX, E-features, F-compliance) lalu **memperbaiki langsung** temuan yang ditemukan. Bukan sekadar laporan — perbaikan kode, migrasi, UI, test, verifikasi. Standar acuan: OWASP ASVS L2/L3, OWASP Top 10, ISO 27001, UU PDP, COSO, WCAG 2.1 AA, SAK ETAP, double-entry accounting.

**Kriteria selesai (Definition of Done):**
- [ ] Ledger `docs/audit/AUDIT-FIX-LEDGER.md` lengkap (ID/Area/Severity/Temuan/Fix/Status/Test).
- [ ] Report `docs/audit/AUDIT-FIX-REPORT.md` ringkas per 26 dimensi.
- [ ] Semua temuan Critical/High di-fix atau dijustifikasi backlog.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build` PASS.
- [ ] i18n paritas en/id/zh dijaga untuk semua key baru.
- [ ] Audit trail teruji untuk mutasi sensitif baru.
- [ ] 2FA tetap opsional.

## Plan

1. [x] Phase 0 — Baca dokumen sumber, baseline checks, fix baseline test failures
2. [ ] Phase B — Security: auth, RBAC, MCP guardrails, endpoint authz, upload, headers, rate limit, PII, CI/CD, integrasi eksternal
3. [ ] Phase A — Correctness: invariant bisnis, CRUD/filter/sort/pagination, DB integrity, POS sync, timezone
4. [ ] Phase F — Compliance: i18n parity, audit trail immutability, whistleblower anonymity
5. [ ] Phase D — UX: mismatch BE↔UI, componentize, responsive/a11y, native dialog removal
6. [ ] Phase E — Features: BI interaktif, XLSX export, custom-field engine, hapus akun member, F&B-specific
7. [ ] Phase C — Architecture: layering, enterprise/production-readiness, clean code, scalability
8. [ ] Phase Z — Reporting: finalize ledger + report + checkpoint + TASK.md

## Done so far

- 2026-05-24 15:30 — Baseline typecheck PASS, baseline test FAIL (7) → diperbaiki menjadi 550/550 PASS + 65/65 shared PASS.
- 2026-05-24 15:30 — Baseline ledger entries BASELINE-001..003 ditulis ke `docs/audit/AUDIT-FIX-LEDGER.md`.
- 2026-05-24 15:30 — Membaca AGENTS.md, TASK.md, AUDIT-REPORT.md (T-0168), PRODUCTION-READINESS.md, CONFIGURATION.md, custom-field-engine.md, MCP server/auth/context/helpers, schema/services inventory.

## Decisions

- T-0170 dibuat sebagai task tunggal untuk audit besar ini agar jejaknya kohesif. Tidak split per dimensi.
- T-0169 (shift × manual sales integration) yang IN_PROGRESS tidak diambil-alih dalam scope ini — terpisah; tapi gap-nya dicatat ke backlog ledger.
- Test stabilization (BASELINE-001..003) dikerjakan terlebih dahulu sebagai prasyarat agar audit punya baseline hijau, sesuai aturan "Jangan rusak build".

## Open issues / Questions

- T-0169 punya Next step "Edit packages/db/schema/pos.ts line 60-70 tambahkan shiftId" yang belum dieksekusi. Diserahkan kembali ke owner T-0169 atau diberi catatan backlog di ledger T-0170.

## Next step

Mulai **Phase B (Security)** dengan urutan:
1. Audit `apps/web/middleware.ts` + `lib/auth.ts` untuk authz boundary.
2. Audit semua route handler di `apps/web/app/api/**/route.ts` dan `apps/site/app/api/**/route.ts` — daftar yang lupa cek `requirePermission`.
3. Audit `apps/web/app/(dash)/**/actions.ts` Server Actions — sama.
4. Audit MCP tools di `apps/mcp/src/tools/{phase2,phase3,iam,accounting,reporting,tax}.ts` untuk scoping & permission gate.
5. Audit upload paths `apps/web/app/api/uploads/[...key]/route.ts` & `api/accounting/journal-attachments` untuk MIME validation, traversal, dan authz.
6. Audit security headers di `apps/web/next.config.ts` & `apps/site/next.config.ts`.

## Test status

- **Unit**: 615/615 PASS (550 services + 65 shared)
- **Typecheck**: PASS (10 workspaces)
- **Lint**: baseline debt (332 err/488 warn) — tidak diperburuk
- **Build**: belum dijalankan (akan setelah perubahan signifikan)
- **E2E**: N/A

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `packages/services/tests/pos.test.ts` | Updated | Add idempotencyKey to Void/Refund schema test inputs + negative case |
| `packages/services/tests/accounting-create-journal.test.ts` | Updated | Fix import path `accounting/number-generator` → `shared/number-generator` |
| `packages/services/tests/member-password-reset.test.ts` | Updated | Mock `../src/member/password` to avoid bcrypt cost-12 timeout |
| `docs/audit/AUDIT-FIX-LEDGER.md` | Added | T-0170 ledger skeleton with baseline rows |
| `docs/checkpoints/T-0170-audit-26-dimensions.checkpoint.md` | Added | This checkpoint |
| `TASK.md` | (next) | Add T-0170 entry |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(akan dicommit setelah phase B selesai)_ | | |

## Handoff Notes

- Baseline hijau sebelum audit dimulai; jangan lupa jaga hijau setelah setiap batch perubahan.
- Hindari mengubah migrasi lama (0000-0028); selalu generate migrasi baru.
- 2FA harus tetap opsional — apa pun perubahan auth.
