/**
 * Custom Fields Settings Page — SD §9.9, §17.3
 * View, create, and manage custom field definitions per entity type.
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchCustomFields } from './actions';
import { CustomFieldsClient } from './custom-fields-client';

export const metadata: Metadata = {
  title: 'Custom Fields — Settings',
};

export default async function CustomFieldsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  const userId = ((session.user as Record<string, unknown>)?.id as string) ?? '';
  const fields = await fetchCustomFields(tenantId);

  const ctx = { userId, tenantId, locationId: '' };

  return <CustomFieldsClient initialFields={fields} ctx={ctx} />;
}
