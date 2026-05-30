/**
 * Workflow Editor Settings Page — SD §9.10, §18
 * Create, edit, and manage approval workflow definitions.
 */

import { getSession } from '@/lib/auth';
import { hasGlobalPermission } from '@/lib/authz';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchWorkflowDefinitions } from './actions';
import { WorkflowEditorClient } from './workflow-editor-client';

export const metadata: Metadata = {
  title: 'Workflow Editor',
};

export default async function WorkflowEditorPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  const userId = ((session.user as Record<string, unknown>)?.id as string) ?? '';
  const allowed = await hasGlobalPermission(userId, 'settings.manage');
  if (!allowed) redirect('/dashboard');
  const definitions = await fetchWorkflowDefinitions(tenantId);

  const ctx = { userId, tenantId, locationId: '' };

  return <WorkflowEditorClient initialDefinitions={definitions} ctx={ctx} />;
}
