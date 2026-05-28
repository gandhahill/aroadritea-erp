# T-0202: Automated PDF Invoice Generation (Print View)

**Status**: 🟨 IN_PROGRESS
**Owner**: Antigravity
**Started**: 2026-05-28 17:08 WIB
**Last Updated**: 2026-05-28 17:10 WIB

## Goal
Implement a Print View for Journal Entries that acts as an automated PDF invoice and receipt generator. It must include the company logo, active bank accounts, dynamic titles (INVOICE/RECEIPT), and support full i18n without adding heavy backend dependencies.

## Log

- **[2026-05-28]**: Researched codebase and found constraints (2GB RAM). Decided on `window.print()` approach to ensure perfect UI match, zero new dependencies, and native browser PDF generation.
- **[2026-05-28]**: Created Implementation Plan. User approved.
- **[2026-05-28]**: Added to `TASK.md`. Starting implementation of `fetchPrintJournalData` action.

## Next step
Implement `fetchPrintJournalData` in `apps/web/app/(dash)/accounting/journals/actions.ts` to fetch journal data along with active bank accounts, then add i18n keys to `en.json`, `id.json`, and `zh.json`.
