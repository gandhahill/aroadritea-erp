/**
 * Helpdesk ticket detail — T-0184.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { getTicketAction } from '../actions';
import { TicketDetailClient } from './ticket-detail-client';

export const metadata: Metadata = { title: 'Ticket Detail | Aroadri ERP' };

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const userId = String((session.user as Record<string, unknown>)?.id ?? '');
  const { id } = await params;
  const t = await getTranslations('helpdesk');

  const result = await getTicketAction(id);
  if (result.error || !result.data) notFound();
  const ticket = result.data;
  const canHandle = await can(userId, 'helpdesk.handle');

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${ticket.number} — ${ticket.subject}`}
        description={`${t('reportedBy')} ${ticket.reporterName ?? '—'} · ${ticket.createdAt.slice(0, 10)}${ticket.createdVia === 'ai_chat' ? ` · 🤖 ${t('viaAi')}` : ''}`}
      />
      <TicketDetailClient ticket={ticket} canHandle={canHandle} currentUserId={userId} />
    </div>
  );
}
