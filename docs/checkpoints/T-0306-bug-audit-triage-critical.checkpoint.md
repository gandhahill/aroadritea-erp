# Checkpoint: T-0306 — Triage FUNCTIONAL_BUG_AUDIT.md CRITICAL #1-4

- **Owner**: claude-sonnet-4-6
- **Started**: 2026-06-13 (lanjutan sesi yang sama dengan T-0305)
- **Last updated**: 2026-06-13
- **Status**: 🟩 DONE
- **Phase**: 3 (lanjutan T-0299 dual-lens audit, dari sumber eksternal)
- **Branch**: master (commit langsung, docs-only)

## Goal

T-0305's "Next step" mandated cross-verifying `FUNCTIONAL_BUG_AUDIT.md`'s CRITICAL #1
("Invoice Payment Routes to Wrong Account") and #2 ("Refund Amount Can Exceed Original
Payment") against current code. This task extended that to all 4 CRITICAL findings (#1,
#2, #3 "Donation Amount Can Exceed Tendered Cash", #4 "Sale Duplicate Prevention Fails
Under Load") since they form a natural CRITICAL-severity batch and #4 was quick to verify.

This is a **docs-only task** — no source code changes. Goal is to (a) record a verdict
per bug so future sessions don't re-investigate, and (b) document any *new* real findings
surfaced during the review.

**Kriteria selesai (Definition of Done):**
- [x] Bug #1 verdict recorded with code-level reasoning
- [x] Bug #2 verdict recorded with code-level reasoning
- [x] Bug #3 verdict recorded with code-level reasoning (invariant proof)
- [x] Bug #4 verdict recorded with code-level reasoning
- [x] Any new finding surfaced during review backlogged with a G-code
- [x] `docs/benchmark/fnb-erp-gap-analysis.md` Part D/E/F updated (G17 + triage log + continuation plan)
- [x] TASK.md updated (T-0306 row in Phase 3 Done table)
- [x] Checkpoint created + commit + push

## Plan

1. [x] Re-read `FUNCTIONAL_BUG_AUDIT.md` CRITICAL #1-4 claims
2. [x] #1: read `accounting/invoice.ts` `payInvoice` (partnerLine matching) + `postInvoice`
   (journalLinesData construction) — verify whether income/expense lines can ever match
   the partnerLine predicate
3. [x] #2: read `pos/refund-sale.ts` qty validation + `lineRefundAmount` formula in full
4. [x] #3: read `pos/create-sale.ts` `normalizeSalePayments` in full, prove or disprove
   `sum(paymentDonation) === donationResult.donatedAmount` and no over-allocation
5. [x] #4: read `packages/services/src/shared/idempotency.ts` `claimIdempotency` in full
6. [x] Document new finding from #1 review (postInvoice tax-line imbalance) as **G17**
7. [x] Update `docs/benchmark/fnb-erp-gap-analysis.md`: G17 row (Part D), new "Decisions
   needed from Lintang" bullet, new Part F triage log, Part E continuation plan rewrite
8. [x] Add T-0306 row to TASK.md Phase 3 Done table
9. [x] Commit (single commit, docs-only) + push to `master`

## Done so far

- **Bug #1 (Invoice Payment Routes to Wrong Account) → FALSE POSITIVE.** `payInvoice`'s
  `partnerLine` match (`l.debit === invoice.total && l.credit === 0n` for sales, symmetric
  for purchase) can structurally only match the AR/AP partner line created in
  `postInvoice`'s `journalLinesData[0]`. Income/expense lines (lines 180-189) always have
  `debit='0'` for sales / `credit='0'` for purchase — they can never satisfy the predicate
  unless `invoice.total === 0n`, and `createJournal` already rejects zero-amount lines.
- **NEW FINDING — G17 (P0)**: while verifying #1, discovered `postInvoice`
  (`packages/services/src/accounting/invoice.ts` lines 168-189) never emits a tax JE
  line. The AR/AP partner line carries `invoice.total` (= subtotal + tax), but
  income/expense lines only carry `line.subtotal` (excludes `line.taxAmount`/
  `invoiceLines.taxAmount`). For ANY invoice with `taxAmount > 0n`,
  `totalDebit !== totalCredit` and `createJournal`'s balance check
  (`create-journal.ts` ~line 141) rejects with `accounting.journal.notBalanced`. The
  manual-invoice UI (`apps/web/app/(dash)/accounting/invoices/new/client.tsx` ~465-475)
  already exposes a tax-rate selector (0 / PB1 10% / PPN 11%) but it is end-to-end broken
  for any non-zero rate — likely never exercised in production. Backlogged as **G17** in
  `docs/benchmark/fnb-erp-gap-analysis.md` Part D with full fix scope (schema migration +
  service + UI), gated on a Lintang decision about tax-code mapping for manual invoices
  (added to "Decisions needed from Lintang").
- **Bug #2 (Refund Amount Can Exceed Original Payment) → FALSE POSITIVE.** Read full
  `pos/refund-sale.ts` (636 lines). Qty validation (`rl.qty > remainingQty` rejected,
  `remainingQty <= originalQty`) combined with
  `lineRefundAmount = lineTotal * BigInt(rl.qty) / BigInt(originalQty)` mathematically
  guarantees `lineRefundAmount <= lineTotal` whenever `0 <= qty <= originalQty`. The
  audit's reproduction requires direct DB tampering of `lineTotal`, an out-of-band
  integrity assumption shared by every service, not an application-logic flaw.
- **Bug #3 (Donation Amount Can Exceed Tendered Cash) → FALSE POSITIVE.** Read full
  `normalizeSalePayments` (`pos/create-sale.ts` lines 118-206). Proved by induction that
  the loop maintains the invariant `donationRemaining <= cashRetainedRemaining` across
  every iteration (base case: `donatedAmount <= cashNeededForSale + donatedAmount` is
  trivially true since `cashNeededForSale >= 0`; inductive step: both
  `minBigint`-bounded decrements preserve the inequality). Consequence: when the loop
  exits with `cashRetainedRemaining === 0` (the only non-error exit), `donationRemaining`
  must also be `0`, so `sum(paymentDonation) === donationResult.donatedAmount` exactly.
  The final `if (cashRetainedRemaining > 0n) return err(AppError.internal(...))` guard
  (line ~197) is precisely the validation the audit claims is missing — it's just
  expressed as a post-hoc remainder check instead of a pre-check, but is equally
  effective (an internal-error guard that should never fire given the upstream
  `cashTendered >= cashNeededForSale` check).
- **Bug #4 (Sale Duplicate Prevention Fails Under Load) → FALSE POSITIVE.** Read full
  `packages/services/src/shared/idempotency.ts` (136 lines). `claimIdempotency` already
  performs `INSERT ... ON CONFLICT DO NOTHING ... RETURNING` against a unique
  `(idempotencyKey, locationId)` DB constraint — exactly the atomic "Option 1: Database
  constraint" fix the audit itself recommends. The audit's claim "No idempotency key
  check visible in provided code" indicates the auditor's code excerpt didn't include
  this file.
- `docs/benchmark/fnb-erp-gap-analysis.md`:
  - Part D: added **G17** row (postInvoice tax-line imbalance, P0, full fix scope).
  - "Decisions needed from Lintang": added G17 bullet (tax-code mapping for manual
    invoices).
  - New **Part F — External audit triage log**: table of verdicts for
    `COMPREHENSIVE_ANALYSIS_SUMMARY.md`'s 3 "✓ VERIFIED" bugs (status from T-0305) and
    `FUNCTIONAL_BUG_AUDIT.md`'s 12-bug list (CRITICAL #1-4 = false positive with
    reasoning; #5-12 = not yet reviewed).
  - Part E: item 7 marks this triage done, item 8 rewritten for next session (HIGH #5-9
    + MEDIUM #10-12 + FEATURE_GAP_ANALYSIS.md tail), item 9 = 6 Lintang decisions (added
    G17); next available task ID → T-0307.
- `TASK.md`: added T-0306 row to Phase 3 Done table.

## Decisions

- **Did not attempt to fix G17 in this session.** Even though it's P0 and currently
  completely broken, fixing it correctly requires (a) a schema migration
  (`invoice_lines.tax_code`), (b) resolving the correct `tax_rates.postingAccountId` per
  code (pattern exists in `pos/posting.ts` `resolvePosPostingConfig`), and (c) a UI
  mapping from the existing taxRate selector (0/1000/1100 bps) to actual `tax_rates.code`
  values. Per CLAUDE.md ("If anything is unclear — stop and ask the user"), guessing the
  tax-code mapping risks posting **incorrect GL entries** (silent wrong-books, worse than
  the current loud failure). Backlogged with full scope instead, pending Lintang's answer
  on whether manual-invoice PB1/PPN should route to the same `tax_rates` codes as POS or
  need separate codes.
- **All 4 CRITICAL bugs in FUNCTIONAL_BUG_AUDIT.md are false positives** — this is a
  signal that this particular audit document has low precision overall (it appears to
  have been generated without full visibility into `idempotency.ts` at minimum). HIGH/
  MEDIUM bugs #5-12 should still be reviewed (not skipped), but expectations should be
  calibrated: verify against code, don't assume correctness.

## Open issues / Questions

- `FUNCTIONAL_BUG_AUDIT.md` HIGH #5-9 and MEDIUM #10-12 (8 bugs) not yet reviewed: "Stock
  Goes Negative via Race Condition", "Shift Close Wrong Variance Calculation", "Member
  Point Redemption Race Condition", "Stock Adjustment UOM Not Atomic", "GRN Over-Receipt
  Silently Accepted", + 3 more (titles not yet re-read in this session).
- `FEATURE_GAP_ANALYSIS.md` still only 100/1020 lines read (Manufacturing Orders 0%,
  Batch/Lot/Expiry Tracking 0% already flagged).
- 3 untracked root-level analysis docs (`COMPREHENSIVE_ANALYSIS_SUMMARY.md`,
  `FEATURE_GAP_ANALYSIS.md`, `FUNCTIONAL_BUG_AUDIT.md`) still undecided — left as-is.
- HR error-code i18n gap (`hr.leave.not_pending`, `hr.kasbon.not_pending`,
  `hr.overtime.not_pending` not in any `messages/*.json`) — still unverified whether this
  surfaces raw codes to users (carried over from T-0305, not investigated this session).

## Next step

Continue triaging `FUNCTIONAL_BUG_AUDIT.md` HIGH #5-9 and MEDIUM #10-12 against current
code, following the same discipline as this session (read the actual implementation,
don't trust the audit's claim, record verdict + reasoning in Part F):
1. Re-read `FUNCTIONAL_BUG_AUDIT.md` HIGH section (#5-9) and MEDIUM section (#10-12) in
   full to get exact titles/claims/file:line references.
2. For each, locate the referenced file (likely `inventory/`, `pos/shift-service.ts` or
   similar, `member/loyalty-service.ts`, `inventory/adjustment-service.ts`,
   `purchasing/grn-service.ts`) and verify the claim against actual code — pay particular
   attention to #5 "Stock Goes Negative via Race Condition" and #9 "GRN Over-Receipt
   Silently Accepted" since stock integrity is core to F&B ops.
3. If a real bug → fix + test, following T-0305's pattern (small targeted fix + unit
   test lock-in). If false positive → record verdict + reasoning in Part F. If business
   policy question → backlog as new G-code like G16/G17.
4. After HIGH/MEDIUM triage complete, move to `FEATURE_GAP_ANALYSIS.md` lines 100-1020.
5. Assign T-0307+, create checkpoint(s), commit+push per the two-commit pattern (or
   single-commit for docs-only work as in T-0306).

## Test status

- **Unit/typecheck/lint**: N/A — docs-only change, no source files touched.
- **Integration/E2E**: N/A.

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `docs/benchmark/fnb-erp-gap-analysis.md` | edit | G17 backlog row, new Decisions bullet, new Part F triage log, Part E rewrite |
| `TASK.md` | edit | T-0306 row in Phase 3 Done table |
| `docs/checkpoints/T-0306-bug-audit-triage-critical.checkpoint.md` | new | this file |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| 3ec697d | `docs(T-0306): triage FUNCTIONAL_BUG_AUDIT.md CRITICAL #1-4, backlog G17` | 2026-06-13 |

## Handoff Notes

- 3 root-level analysis docs (`COMPREHENSIVE_ANALYSIS_SUMMARY.md`, `FEATURE_GAP_ANALYSIS.md`,
  `FUNCTIONAL_BUG_AUDIT.md`) remain untracked — left as-is, still undecided.
- Standing authorization remains: "ini adalah tugas panjang, tolong kerjakan sampai
  selesai, tidak perlu terburu-buru" — continue through `FUNCTIONAL_BUG_AUDIT.md`
  HIGH/MEDIUM and `FEATURE_GAP_ANALYSIS.md` without waiting for further prompts.

---

## Aturan File Ini

- **Update**: setiap 100+ baris code atau sub-step Plan diselesaikan.
- **Last updated**: WAJIB diperbarui setiap edit checkpoint.
- **Next step**: WAJIB konkret sebelum exit sesi.
- **Commits**: WAJIB tercatat (minimal SHA + tanggal) untuk bisa di-rebuild kontekstual.
- **Saat selesai**: ubah Status ke 🟩 DONE, lengkapi Commits, lalu update `TASK.md`.
- **Saat archive**: setelah 7 hari dari Done, pindahkan file ke `archive/`.
