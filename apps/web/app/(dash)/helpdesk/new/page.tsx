/**
 * Create new helpdesk ticket — T-0184.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { NewTicketClient } from './new-ticket-client';

export const metadata: Metadata = { title: 'New Ticket' };

export default async function NewHelpdeskTicketPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const t = await getTranslations('helpdesk');
  return (
    <main className="space-y-6 p-6">
      <PageHeader title={t('newTicket')} description={t('newTicketDesc')} />
      <NewTicketClient />
    </main>
  );
}
