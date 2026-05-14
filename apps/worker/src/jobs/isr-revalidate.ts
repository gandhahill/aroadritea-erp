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

  throw new Error(
    'ISR revalidation job is not configured. Keep this scheduled job disabled until a signed public-site revalidation endpoint is available.',
  );
}
