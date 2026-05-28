/**
 * AI Assistant — individual chat session (User Req 1, ADR-0013).
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { isAiAssistantEnabled } from '@erp/services/ai';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { fetchSession } from '../actions';
import { ChatSessionClient } from './chat-session-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('aiAssistantChat');
  return { title: `${t('title')} | Aroadri ERP` };
}

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
    const t = await getTranslations('aiAssistantChat');
    if (result.error === 'ai.session.notFound') notFound();
    return (
      <div className="space-y-4">
        <PageHeader title={t('title')} description={t('loadErrorDescription')} />
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {result.error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={result.session.title}
        description={(await getTranslations('aiAssistantChat'))('status', {
          status: result.session.status,
        })}
      />
      <ChatSessionClient
        enabled={isAiAssistantEnabled()}
        sessionId={result.session.id}
        allowWebSearch={result.session.allowWebSearch}
        initialMessages={result.messages}
      />
    </div>
  );
}
