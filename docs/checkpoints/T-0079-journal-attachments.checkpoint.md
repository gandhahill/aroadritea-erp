# T-0079 — Service journal attachments + MCP tools

| Field | Value |
|-------|-------|
| **Owner** | Claude Opus 4.6 |
| **Started** | 2026-05-10 |
| **Last updated** | 2026-05-10 |
| **Status** | 🟩 DONE |
| **Phase** | 2 |
| **Branch** | master |

---

## Done

### Schema
- `journalAttachments` table: pk, journalEntryId, fileKey, fileName, fileSize, mimeType, uploadedBy, uploadedAt
- Relations: journalEntry → journalEntries, uploader → users
- Added `attachments: many(journalAttachments)` to journalEntriesRelations

### Service (journal-attachments.ts)
- `createJournalAttachment` — metadata record after file upload
- `listJournalAttachments` — list all attachments for a JE
- `deleteJournalAttachment` — hard delete + audit log
- `getJournalWithAttachments` — JE + lines + attachments (for MCP)
- Zod schema: `CreateJournalAttachmentSchema`

### MCP Tools
- `accounting.get_journal_with_attachments` — returns journal + lines + attachment metadata
- `accounting.list_journal_attachments` — list attachments by journal entry ID

### Note
Actual file upload/download was completed later through the server API layer. Service metadata remains reusable if object storage is added.

## Files Touched

| File | Action |
|------|--------|
| `packages/db/schema/accounting.ts` | Modified — added table + relations |
| `packages/db/index.ts` | Modified — barrel export |
| `packages/services/src/accounting/journal-attachments.ts` | Added |
| `packages/services/src/accounting/schemas.ts` | Modified — 1 schema |
| `packages/services/src/accounting/index.ts` | Modified — barrel exports |
| `apps/mcp/src/tools/accounting.ts` | Modified — 2 MCP tools |
| `apps/mcp/src/tools/index.ts` | Modified — schema exports |

## Next step

Task complete.
