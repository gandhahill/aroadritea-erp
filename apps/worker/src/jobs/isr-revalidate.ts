/**
 * ISR revalidation job — invalidate Next.js cache when CMS content changes.
 * SD §31.4: ISR + on-demand revalidation via webhook from CMS publish.
 * Also runs nightly full revalidation of public pages.
 */

export interface IsrRevalidateJobData {
  path?: string;
  tag?: string;
  tenantId?: string;
  fullRevalidate?: boolean;
}

export async function isrRevalidateHandler(data: IsrRevalidateJobData): Promise<void> {
  const { path, tag, tenantId, fullRevalidate } = data;
  console.info(`[isr-revalidate] Starting ISR revalidation`, {
    path,
    tag,
    tenantId,
    fullRevalidate,
  });

  try {
    // TODO (Phase 5 — T-0121): implement ISR revalidation
    // Phase 1: just log. ISR is Phase 5 feature.
    // When implemented:
    // - Per-page: POST to /api/revalidate with secret
    // - By tag: Next.js revalidateTag(tag)
    // - Full: iterate all public paths from CMS
    console.info('[isr-revalidate] ISR revalidation completed (placeholder — Phase 5)', {
      path,
      tag,
    });
  } catch (err) {
    console.error('[isr-revalidate] ISR revalidation failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
