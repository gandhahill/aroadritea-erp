/**
 * AI Assistant — landing page (User Req 1, ADR-0013).
 *
 * Lists the user's sessions on the left, opens the latest active one
 * on the right (or shows an empty state with a "Start new chat" CTA).
 * Admins additionally see every session in their tenant.
 */

import { getSession } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { can } from '@erp/services/iam';
import { isAiAssistantEnabled } from '@erp/services/ai';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchAllSessionsAdmin, fetchMySessions } from './actions';
import { AiAssistantClient } from './ai-assistant-client';

export const metadata: Metadata = { title: 'AI Assistant' };

export default async function AiAssistantLandingPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const userId = String((session.user as Record<string, unknown>).id ?? '');
  const canUse = await can(userId, 'ai.assistant.use');
  if (!canUse) redirect('/dashboard');
  const isAdmin = await can(userId, 'ai.assistant.admin');

  const enabled = isAiAssistantEnabled();
  const mySessions = await fetchMySessions();
  const adminSessions = isAdmin ? await fetchAllSessionsAdmin() : { ok: true as const, items: [] };

  return (
    <main className="space-y-6 p-6">
      <PageHeader
        title="Asisten AI"
        description="Tanyakan alur kerja, deteksi error, atau bantu OCR struk POS lama. Identitas dan izin Anda dihormati pada setiap perintah."
      />
      <AiAssistantClient
        enabled={enabled}
        canAdmin={isAdmin}
        ownSessions={mySessions.ok ? mySessions.items : []}
        allSessions={adminSessions.ok ? adminSessions.items : []}
        ownError={mySessions.ok ? null : mySessions.error}
        adminError={adminSessions.ok ? null : adminSessions.error}
      />
    </main>
  );
}
