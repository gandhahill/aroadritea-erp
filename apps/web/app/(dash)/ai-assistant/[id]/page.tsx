/**
 * AI Assistant — individual chat session (User Req 1, ADR-0013).
 */

import { getSession } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { can } from '@erp/services/iam';
import { isAiAssistantEnabled } from '@erp/services/ai';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { fetchSession } from '../actions';
import { ChatSessionClient } from './chat-session-client';

export const metadata: Metadata = { title: 'AI Chat' };

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const userId = String((session.user as Record<string, unknown>).id ?? '');
  const canUse = await can(userId, 'ai.assistant.use');
  if (!canUse) redirect('/dashboard');

  const { id } = await params;
  const result = await fetchSession(id);
  if (!result.ok) {
    if (result.error === 'ai.session.notFound') notFound();
    return (
      <main className="space-y-4 p-6">
        <PageHeader title="AI Assistant" description="Sesi tidak dapat dimuat." />
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {result.error}
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-full flex-col p-6">
      <PageHeader title={result.session.title} description={`Status: ${result.session.status}`} />
      <ChatSessionClient
        enabled={isAiAssistantEnabled()}
        sessionId={result.session.id}
        initialMessages={result.messages}
      />
    </main>
  );
}
