# T-0200: Add AI Assistant and OCR limitations to documentation

## Status
🟩 DONE

## Owner
Antigravity

## Started
2026-05-27 18:06 WIB

## Last Updated
2026-05-27 18:07 WIB

## Goal
The user requested an update to the operational guidelines (Docs) to explicitly inform employees that the AI Assistant's built-in image processing (OCR) is currently suboptimal due to local Tesseract limitations. The documentation should direct users to use their personal ChatGPT or Gemini with vision support to extract the text, and then copy-paste it into the ERP's AI Assistant to generate accurate drafts.

## Progress
- [x] Located `apps/web/app/(dash)/docs/docs-content.ts`.
- [x] Inserted a new section with id `ai-assistant` under the `settings-support` section for all three supported locales (`id`, `en`, `zh`).
- [x] Included explicit instructions recommending ChatGPT/Gemini and checking drafts before posting.
- [x] Committed and triggered VPS deployment.
