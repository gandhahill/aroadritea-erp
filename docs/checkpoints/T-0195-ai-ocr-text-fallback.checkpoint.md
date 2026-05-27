# T-0195: Upgrade OCR fallback to route local text through LLM

## Status
🟩 DONE

## Owner
Antigravity

## Started
2026-05-27 17:15 WIB

## Last Updated
2026-05-27 17:15 WIB

## Goal
The user noted that regex parsing is too rigid and cannot adapt to receipt structure changes. Because DeepSeek v4 flash does not support vision yet, we currently fall back to Tesseract + Regex. We will instead pipe the Tesseract OCR raw text into DeepSeek via a text prompt. This allows DeepSeek to use its reasoning capabilities to extract JSON from the messy Tesseract text, providing maximum flexibility even without a vision model.

## Progress
- [ ] Update `ocr-receipt.ts` to build text-only `messages` when `!config.supportsVision`.
- [ ] Run test suite.
- [ ] Report success to user.
