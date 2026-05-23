'use server';

import { getSession } from '@/lib/auth';
import { db, eq } from '@erp/db';
import { users } from '@erp/db/schema/auth';
import { AppError } from '@erp/shared/errors';
import { revalidatePath } from 'next/cache';

export async function clearPasswordRequirementAction() {
  const session = await getSession();
  if (!session?.user) {
    throw AppError.internal('unauthenticated', new Error('Not logged in'));
  }

  await db
    .update(users)
    .set({ requirePasswordChange: false })
    .where(eq(users.id, session.user.id));

  revalidatePath('/', 'layout');
  return { ok: true };
}
