# Checkpoint: T-0183 — CRM Member-Data page for management

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-25 19:55 WIB
- **Last updated**: 2026-05-25 20:15 WIB
- **Status**: 🟩 DONE

## Why

User: "tambah halaman data member bagi manajemen". The
`/member/akun` page is self-service for members; there was no
admin/manager view. Loyalty data lives in `member_loyalty` joined to
`partners` (kind='customer', is_member=true).

## Done

- **Permissions** (`packages/db/seed/iam.ts`):
  - `crm.member.view` — list + detail page.
  - `crm.member.adjustPoints` — show + use the adjustment form.
  - Granted to `management` role; director/vice_director get all.
- **Service** `packages/services/src/crm/member-service.ts`:
  - `listMembers(filter, ctx)` — partners ⨝ member_loyalty, search
    by name/city (email + phone are encrypted at-rest so they're
    excluded from the search index), filter by tier, pagination.
  - `getMemberDetail(memberId, ctx)` — partner row + loyalty row +
    last 30 points transactions.
  - `adjustMemberPoints(input, ctx)` — validates non-zero delta +
    ≥3-char reason; rejects when the resulting balance would go
    negative; only grows lifetime points on positive delta; writes a
    `member_points_transactions` row of type `adjust` with the
    reason mapped into the `description` JSONB (id/en/zh); records
    audit (entity=member, action=update, before/after balances).
- **UI** `apps/web/app/(dash)/crm/members/`:
  - `page.tsx` — table with name/tier/points/lifetime/joined, search
    + tier filter + pagination, tier-coloured badges.
  - `[id]/page.tsx` — 4 KPI cards (tier / points / lifetime / last
    earned) + contact-info dl + recent points table (red for
    decrement, jade for increment) + `<PointsAdjustClient>` when
    the requester has `crm.member.adjustPoints`.
  - `[id]/points-adjust-client.tsx` — small form (delta + reason)
    that calls the server action and shows success/error inline.
- **Sidebar** new top-level "CRM" group (icon = users) with a single
  "Members" child today. Sits between AI Assistant and HR.
- **i18n parity** id/en/zh for the full `crm.members.*` namespace +
  top-level sidebar labels `crm` + `members`.

## Notes / decisions

- Email + phone are excluded from the search predicate because
  they're stored encrypted for lookup; future improvement is to add
  a `searchByEncryptedField` helper that re-encrypts the query then
  matches.
- Lifetime points convention: positive deltas grow lifetime;
  negative deltas (compensation reversals, expired pruning) leave
  lifetime untouched. Keeps the leaderboard meaningful.
- Adjustment writes a real `member_points_transactions` row so the
  member can see "manual adjustment: ..." in their /member/akun
  history (already supported by the existing UI).
- `manual_adjust` referenceType keeps this distinguishable from POS
  earn/redeem in BI reports.

## Verification

- `pnpm -r typecheck` PASS across 10 workspaces.
- `pnpm -r test`: 685/685 PASS (no regression).

## Backlog (carry-over to T-0184+)

- T-0184 Helpdesk/ticketing + AI integration.
- T-0185 Internal courier shipment tracking (BinderByte).
- Wire purchase history (last 10 orders) into member detail page.
- Export member list as XLSX.
- Search by encrypted email via the PII lookup helper.
- MCP tool `adjust_member_points_draft` for AI-driven compensation.
