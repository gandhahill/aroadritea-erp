# T-0197: Fix truncated OCR notes in manual sale draft

## Status
🟩 DONE

## Owner
Antigravity

## Started
2026-05-27 17:39 WIB

## Last Updated
2026-05-27 17:41 WIB

## Goal
The user noticed that the OCR fallback notes rendered in the manual sale draft UI were truncated at 120 characters (e.g., stopping at "Bamboo O"). This hides the unresolved item list when OCR uses text-fallback.

## Progress
- [x] Identified `.slice(0, 120)` hardcoded in `packages/services/src/ai/tools/create-manual-sale-draft.ts`.
- [x] Removed the slice. Zod schema already allows up to 1000 characters, and PG `text` handles it fine.
- [x] Committed, pushed, and deployed to VPS.
