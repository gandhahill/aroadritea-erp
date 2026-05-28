/**
 * Custom Fields Settings Page — SD §9.9, §17.3
 * View, create, and manage custom field definitions per entity type.
 *
 * Security: the session check below gates entry; the page no longer
 * forwards `ctx` to the client because the Server Actions now resolve
 * their own AuditContext from the live session on every invocation
 * (see ./actions.ts for the rationale).
 */

import { getSession } from '@/lib/auth';
import { hasGlobalPermission } from '@/lib/authz';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchCustomFields } from './actions';
import { CustomFieldsClient } from './custom-fields-client';

export const metadata: Metadata = {
  title: 'Custom Fields | Aroadri ERP',
};

export default async function CustomFieldsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const allowed = await hasGlobalPermission(String(user.id ?? ''), 'settings.manage');
  if (!allowed) redirect('/dashboard');

  const fields = await fetchCustomFields();
  return <CustomFieldsClient initialFields={fields} />;
}
