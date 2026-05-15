/**
 * ISR revalidation job.
 *
 * CMS server actions already revalidate ERP admin pages directly. Public-site
 * scheduled revalidation is fail-closed until a signed endpoint is configured.
 */

export interface IsrRevalidateJobData {
  path?: string;
  tag?: string;
  tenantId?: string;
  fullRevalidate?: boolean;
}

export async function isrRevalidateHandler(data: IsrRevalidateJobData): Promise<void> {
  const { path, tag, tenantId, fullRevalidate } = data;
  console.info('[isr-revalidate] Starting ISR revalidation', {
    path,
    tag,
    tenantId,
    fullRevalidate,
  });

  const endpoint = process.env.SITE_REVALIDATE_URL;
  const secret = process.env.SITE_REVALIDATE_SECRET;
  if (!endpoint || !secret) {
    console.warn(
      '[isr-revalidate] Skipped because SITE_REVALIDATE_URL or SITE_REVALIDATE_SECRET is not configured.',
    );
    return;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      'User-Agent': 'aroadri-erp-worker/1.0 isr-revalidate',
    },
    body: JSON.stringify({
      path,
      tag,
      tenantId,
      fullRevalidate: fullRevalidate === true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`ISR revalidation failed: ${response.status} ${response.statusText} ${body}`);
  }

  console.info('[isr-revalidate] Revalidation request accepted', { status: response.status });
}
