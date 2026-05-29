# T-0213: Wire postJournal/reverseJournal ke server action + tombol UI

## Status
🟩 DONE

## Owner
Antigravity

## Started
2026-05-29

## Goal
Wire backend services `postJournal` and `reverseJournal` to web UI.
Render `OpenPeriodButton` in the periods page.
Add edit/delete functionality for draft journals.

## Progress
- Added `deleteJournal` service in `delete-journal.ts`.
- Added server actions in `journals/actions.ts` for post, reverse, and delete.
- Created `JournalActionsUI` client component with i18n support.
- Embedded `JournalActionsUI` in journal detail `page.tsx`.
- Registered `OpenPeriodButton` in `periods/page.tsx` PageHeader.
- Passed typechecks.

## Next step
Ready to move on to the next task in the backlog.
