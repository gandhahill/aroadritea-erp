'use server';

import { getSession } from '@/lib/auth';
import { submitWhistleblowerReport } from '@erp/services/hr';

/**
 * Submit a whistleblower report.
 *
 * Anonymity (AGENTS.md "audit trail ANONIM"): we verify a session exists
 * so the form is only available to logged-in employees, but we DO NOT
 * forward the user's id, IP, or user-agent into the service. The
 * persisted row and any future audit query therefore cannot tie a
 * submission back to a specific employee.
 */
export async function submitWhistleblowerAction(_prevState: unknown, formData: FormData) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: 'Unauthorized' };
  }

  const title = String(formData.get('title') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const rawAttachment = formData.get('attachmentUrl');
  const attachmentUrl = typeof rawAttachment === 'string' ? rawAttachment.trim() : '';

  if (!title || !category || !content) {
    return { ok: false as const, error: 'Missing required fields' };
  }

  const tenantId = String((session.user as Record<string, unknown>)?.tenantId ?? 'default');

  try {
    const result = await submitWhistleblowerReport({
      tenantId,
      title,
      category,
      content,
      attachmentUrl: attachmentUrl || undefined,
    });

    if (!result.ok) {
      return {
        ok: false as const,
        error: result.error?.messageKey ?? 'Error submitting report',
      };
    }

    return { ok: true as const, id: result.value.id };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
