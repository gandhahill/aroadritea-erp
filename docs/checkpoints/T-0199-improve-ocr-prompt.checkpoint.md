# T-0199: Improve OCR prompt for Tesseract fallback wrapping issues

## Status
🟩 DONE

## Owner
Antigravity

## Started
2026-05-27 18:03 WIB

## Last Updated
2026-05-27 18:04 WIB

## Goal
The user demonstrated that DeepSeek (via web) parses the raw Tesseract text correctly but places quantities (2, 1, 1, 1) inside the `Name` column (e.g. `Osmanthus Oolong Milk Tea [700ml, S 2 tandard, sugar, Standard, ice]`) because Tesseract scrambles the line wrapping. The ERP's `ocr-receipt.ts` schema enforces strictly typed `qty: number`, which caused DeepSeek to drop these items or misparse them completely when used as a fallback parser.

## Progress
- [x] Identified that quantities were merged into item names (e.g. `S 2 tandard` instead of `Standard`).
- [x] Added explicit `systemPrompt` rule in `packages/services/src/ai/tools/ocr-receipt.ts` instructing the LLM to detect these embedded quantities, extract them, and clean up the item name.
- [x] Committed and triggered VPS deployment.
