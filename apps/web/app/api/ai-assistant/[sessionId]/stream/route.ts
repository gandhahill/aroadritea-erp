import { getSession } from '@/lib/auth';
import { getAiSession, sendChatMessage } from '@erp/services/ai';
import type { AuditContext } from '@erp/shared/types';

export const dynamic = 'force-dynamic';

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function resolveCtx(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  if (!userId || !tenantId) return null;
  return { userId, tenantId, locationId: String(user.locationId ?? '') };
}

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  if (!sameOrigin(req)) {
    return new Response('forbidden', { status: 403 });
  }
  const ctx = await resolveCtx();
  if (!ctx) return new Response('unauthenticated', { status: 401 });

  const { sessionId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    content?: string;
    useReasoning?: boolean;
    attachments?: Array<{ url: string; mimeType: string }>;
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const result = await sendChatMessage(
          {
            sessionId,
            content: String(body.content ?? ''),
            useReasoning: Boolean(body.useReasoning),
            attachments: Array.isArray(body.attachments) ? body.attachments : undefined,
          },
          ctx,
          {
            onReasoningDelta: (text) => send({ type: 'reasoning_delta', text }),
            onContentDelta: (text) => send({ type: 'content_delta', text }),
            onToolCall: (toolName) => send({ type: 'tool_call', toolName }),
            onToolResult: (toolName) => send({ type: 'tool_result', toolName }),
          },
        );

        if (!result.ok) {
          send({ type: 'error', error: result.error.messageKey, details: result.error.details });
          controller.close();
          return;
        }

        const refreshed = await getAiSession(sessionId, ctx);
        send({
          type: 'done',
          reply: result.value.reply,
          reasoning: result.value.reasoning ?? null,
          messageId: result.value.assistantMessageId,
          toolRoundsExecuted: result.value.toolRoundsExecuted,
          messages: refreshed.ok ? refreshed.value.messages : null,
        });
        controller.close();
      } catch (e) {
        send({
          type: 'error',
          error: 'ai.stream.failed',
          details: e instanceof Error ? e.message : String(e),
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
    },
  });
}
