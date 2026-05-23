'use server';

import { getSession } from '@/lib/auth';
import { submitWhistleblowerReport } from '@erp/services/hr';
import { AppError } from '@erp/shared/errors';

export async function submitWhistleblowerAction(
  _prevState: any,
  formData: FormData
) {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Unauthorized' };
  }

  const title = formData.get('title') as string;
  const category = formData.get('category') as string;
  const content = formData.get('content') as string;

  if (!title || !category || !content) {
    return { ok: false, error: 'Missing required fields' };
  }

  try {
    const result = await submitWhistleblowerReport(
      { title, category, content },
      { userId: session.user.id, tenantId: (session.user as any).tenantId } as any
    );

    if (!result.ok) {
      return { ok: false, error: result.error?.message || 'Error submitting report' };
    }

    return { ok: true, id: result.value.id };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Unknown error' };
  }
}
