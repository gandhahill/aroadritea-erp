# T-0194: Fix AI OCR receipt parsing for lines without brackets

## Status
🟩 DONE

## Owner
Antigravity

## Started
2026-05-27 17:07 WIB

## Last Updated
2026-05-27 17:07 WIB

## Goal
Fix `extractLineItemsFromText` in `ocr-receipt.ts` so that it matches product lines that don't have bracketed modifiers (e.g. `Classic Milk Tea 2 50000`). Currently the regex `^(.+?\])\s+(\d{1,3})\s+([0-9][0-9.,]{2,})\s*$` drops any line without a closing bracket.

## Progress
- [x] Analyze `extractLineItemsFromText` issue
- [x] Test regex `^(.+?)\s+(\d{1,3})\s+([0-9][0-9.,]{2,})\s*$`
- [ ] Apply regex to `ocr-receipt.ts`
- [ ] Verify test suite

## Next step
Edit `ocr-receipt.ts` to replace the `itemRe` with the new regex, then run `pnpm test`.
