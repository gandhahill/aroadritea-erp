/**
 * Scalar API reference page for the public REST API.
 *
 * We embed the Scalar standalone bundle from a CDN rather than adding the
 * `@scalar/hono-api-reference` npm package: it keeps node_modules small
 * (CLAUDE.md §5.7) and avoids new peer dependencies. The page is public and
 * read-only; it loads the in-code spec from `/api/v1/openapi.json`. See
 * ADR-0017.
 *
 * Because the global HTTP middleware sets a strict `default-src 'none'` CSP,
 * the caller must relax CSP for this route (done in http-server.ts).
 */

const SCALAR_CDN = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';

export function renderScalarDocs(specUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Aroadri Tea ERP — API Reference</title>
  </head>
  <body>
    <script id="api-reference" data-url="${specUrl}"></script>
    <script>
      var c = document.getElementById('api-reference');
      c.dataset.configuration = JSON.stringify({
        theme: 'default',
        metaData: { title: 'Aroadri Tea ERP — Public API' },
      });
    </script>
    <script src="${SCALAR_CDN}"></script>
  </body>
</html>`;
}

/** CSP that allows the Scalar bundle + its inline boot script and styles. */
export const SCALAR_CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com data:',
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');
