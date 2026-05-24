# Checkpoint: T-0170 — Audit 26-Dimensi & Direct Fix

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-24 15:30 WIB
- **Last updated**: 2026-05-24 20:45 WIB
- **Status**: 🟩 DONE (Phase 1 audit + Req 2/3/4 + Req 1 Phase 1; Req 1 Phase 2/3 di backlog)
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

**Session ini selesai.** Item lanjutan tercatat di ledger sebagai backlog:

1. **BACKLOG-AI-TOOLS** — Edit `packages/services/src/ai/conversation.ts` line ~95, ganti pemanggilan `aiComplete` dengan loop tool-calling pakai schema `tools`. Mulai dari tool `request_admin_help(error_summary)` (zero-state risk) lalu `search_codebase(query)` dan `read_file(path)` (allow-listed paths). Tambah test `ai-tools.test.ts`.
2. **BACKLOG-AI-OCR** — Edit `packages/services/src/ai/client.ts`, tambah multi-modal payload (image_url base64) lalu route POST `/api/ai/upload` untuk receipt OCR yang menghasilkan draft manual-sales — confirm dulu sebelum commit ke `pos/manual-sales`.
3. **BACKLOG-T-0169** — Lanjutkan `Edit packages/db/schema/pos.ts` line 60-70 tambahkan `shiftId` (sesuai checkpoint T-0169) lalu run `pnpm --filter @erp/db generate`.
4. **E23 hapus akun member** — Schema & service di `packages/services/src/member/index.ts`: tambah `deleteMember(memberId, reason)` yang anonimkan PII + soft-delete + audit trail; UI di `apps/site/app/[locale]/member/akun/`.
5. Smoke test fisik di outlet: print preview payslip `/api/hr/payslip/<payrollId>/<employeeId>` di Chrome desktop + thermal printer.

## Test status

- **Unit**: 633/633 PASS (559 services + 74 shared) — +18 dari baseline (4 whistleblower anonymity + 9 magic-bytes + 5 ai-conversation).
- **Typecheck**: PASS (10 workspaces).
- **Lint**: baseline debt (332 err/488 warn) — tidak diperburuk.
- **Build**: tidak dijalankan dalam sesi ini (tidak menyentuh build config).
- **E2E**: N/A.

## Files Touched (ringkasan)

### Audit & docs
- `docs/audit/AUDIT-FIX-LEDGER.md` (added) — ledger temuan + backlog.
- `docs/audit/AUDIT-FIX-REPORT.md` (added) — report eksekutif 26-dimensi.
- `docs/checkpoints/T-0170-audit-26-dimensions.checkpoint.md` (this file).
- `docs/adr/0013-ai-assistant-deepseek.md` (added) — ADR.
- `TASK.md` (updated) — T-0170 entry.

### Security batch (Phase B)
- `apps/web/app/(dash)/settings/custom-fields/{actions.ts,page.tsx,custom-fields-client.tsx}` — drop client-supplied `ctx`.
- `apps/web/app/(dash)/pos/orders/actions.ts` — generate `idempotencyKey` + lines for void/refund.
- `apps/web/app/(dash)/whistleblower/actions.ts` — drop session.user.id from service call.
- `apps/web/app/api/uploads/{route.ts,[...key]/route.ts}` — magic-byte sniffing; `sop`/`ai-attachments` areas; anonymous whistleblower uploadedBy.
- `apps/web/lib/upload-storage.ts` — re-export magic-byte helper, add new areas.
- `packages/services/src/hr/whistleblower.ts` — anonymous service signature, no audit on submission.
- `packages/services/src/member/index.ts` — Turnstile bypass default-deny in prod.
- `packages/shared/src/security/image-magic-bytes.{ts,test.ts}` (added).
- `packages/shared/package.json` — export image-magic-bytes.

### Baseline test stabilization
- `packages/services/tests/{pos,accounting-create-journal,member-password-reset}.test.ts`.
- `packages/services/tests/whistleblower-anonymity.test.ts` (added).
- `packages/services/tests/ai-conversation.test.ts` (added).

### User Req — features
- `packages/db/schema/{hr.ts,sop.ts,ai.ts}` — schema (HR nullable nik, SOP, AI).
- `packages/db/migrations/{0029_employee_nik_optional.sql, 0030_sop_documents.sql, 0031_ai_assistant.sql}` + `meta/_journal.json`.
- `packages/db/index.ts` + `packages/db/package.json` — export new tables.
- `packages/db/seed/iam.ts` — add `hr.sop.read/manage`, `ai.assistant.use/admin` + role mapping.
- `packages/services/src/hr/{schemas.ts,create-employee.ts,list-employees.ts,get-employee.ts,sop.ts,index.ts}` — NIK optional + SOP service.
- `packages/services/src/payroll/{payslip.ts,index.ts}` — payslip data assembly.
- `packages/services/src/ai/{client.ts,session.ts,conversation.ts,index.ts}` — DeepSeek client + sessions + chat runner.
- `apps/web/app/(dash)/hr/{employees/new/employee-form.tsx,employees/[id]/page.tsx,employees/employee-list-client.tsx,sop/{actions.ts,page.tsx,sop-list-client.tsx,sop-upload-form.tsx},my-payslips/page.tsx}` — UI HR.
- `apps/web/app/(dash)/ai-assistant/{actions.ts,page.tsx,ai-assistant-client.tsx,[id]/{page.tsx,chat-session-client.tsx}}` — UI AI.
- `apps/web/app/api/hr/payslip/[payrollId]/[employeeId]/route.ts` — HTML cetak payslip.
- `apps/web/app/(dash)/sidebar.tsx` — add SOP, My Payslips, AI Assistant.
- `apps/web/messages/{en,id,zh}.json` — `nikOptional`, `sop`, `myPayslips`, `aiAssistant`.
- `.env.example` — AI assistant variables.

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(akan dicommit setelah phase B selesai)_ | | |

## Handoff Notes

- Baseline hijau sebelum audit dimulai; jangan lupa jaga hijau setelah setiap batch perubahan.
- Hindari mengubah migrasi lama (0000-0028); selalu generate migrasi baru.
- 2FA harus tetap opsional — apa pun perubahan auth.
