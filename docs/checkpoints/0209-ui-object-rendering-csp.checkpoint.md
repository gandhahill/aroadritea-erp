# T-0209: Fix UI Object Rendering, Timezone, and CSP bugs

## 1. Goal
Fix React object rendering bugs caused by localized names in dropdowns, update CSP to allow Cloudflare Insights, correct timezone display in active sessions, and refine the User Agent parser to accurately detect Webview/Samsung Internet.

## 2. Implementation Steps
- [x] Fix pps/web/app/(dash)/settings/accounting/client.tsx account name rendering.
- [x] Fix pps/web/app/(dash)/logistics/outgoing-shipments/new/client.tsx location name rendering.
- [x] Unify button styles in logistics module.
- [x] Fix CSP script-src in pps/web/next.config.ts.
- [x] Force Asia/Jakarta timezone in sessions-section.tsx.
- [x] Refine UA parser in sessions-section.tsx for mobile browsers.
- [x] Run pnpm build to ensure everything works.
- [x] Push to GitHub.

## 3. Next step
🟩 DONE