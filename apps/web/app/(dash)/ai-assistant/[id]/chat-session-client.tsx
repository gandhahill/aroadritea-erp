'use client';

import { Button } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useTransition } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toggleSessionWebSearchAction } from '../actions';
import { ConfirmActionCard } from './confirm-action-card';

interface Message {
  id: string;
  role: string;
  content: string;
  toolName?: string | null;
  toolPayload?: unknown;
  createdAt: Date;
  requiresConfirmation: boolean;
}

interface DraftHint {
  draftId: string;
  kind: string;
  summary: string;
  expiresAt: string;
}

/**
 * Tool messages carry their executed payload in `toolPayload`. If the
 * payload's `output` includes `requires_confirmation: true` + `draft_id`,
 * we surface the ConfirmActionCard instead of the raw JSON.
 */
function extractDraftHint(payload: unknown): DraftHint | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const inner = p.payload as { ok?: boolean; output?: unknown } | undefined;
  const output = inner?.output as Record<string, unknown> | undefined;
  if (
    output &&
    output.requires_confirmation === true &&
    typeof output.draft_id === 'string' &&
    typeof output.summary === 'string' &&
    typeof output.expires_at === 'string'
  ) {
    return {
      draftId: output.draft_id,
      kind:
        typeof (output as { kind?: string }).kind === 'string'
          ? (output as { kind: string }).kind
          : 'manual_sale',
      summary: output.summary,
      expiresAt: output.expires_at,
    };
  }
  return null;
}

interface Props {
  enabled: boolean;
  sessionId: string;
  allowWebSearch?: boolean;
  initialMessages: Message[];
}

interface PendingAttachment {
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

type StreamEvent =
  | { type: 'reasoning_delta'; text: string }
  | { type: 'content_delta'; text: string }
  | { type: 'tool_call'; toolName: string }
  | { type: 'tool_result'; toolName: string }
  | {
      type: 'done';
      reply: string;
      reasoning: string | null;
      messageId: string;
      toolRoundsExecuted: number;
      messages: Message[] | null;
    }
  | { type: 'error'; error: string; details?: unknown };

function summariseToolPayload(payload: unknown, toolErrorPrefix: string): string {
  if (!payload || typeof payload !== 'object') return '';
  const p = payload as Record<string, unknown>;
  if (typeof p.call_id === 'string') {
    const inner = (p.payload as { ok?: boolean; output?: unknown; error?: string }) ?? null;
    if (inner) {
      if (inner.ok === false) return `${toolErrorPrefix}${inner.error}`;
      const outputJson = JSON.stringify(inner.output ?? null);
      return outputJson.length > 500 ? `${outputJson.slice(0, 500)}…` : outputJson;
    }
  }
  return JSON.stringify(p).slice(0, 500);
}

function getReasoningContent(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as { reasoning_content?: unknown }).reasoning_content;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function ChatSessionClient(props: Props) {
  const t = useTranslations('aiAssistantChat');
  const [messages, setMessages] = useState<Message[]>(props.initialMessages);
  const [draft, setDraft] = useState('');
  const [useReasoning, setUseReasoning] = useState(false);
  const [allowWebSearch, setAllowWebSearch] = useState(props.allowWebSearch ?? false);
  const [webSearchBusy, setWebSearchBusy] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  });

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      submit();
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('imageOnlyError'));
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('area', 'ai-attachments');
      fd.set('visibility', 'private');
      fd.set('imageOnly', 'true');
      const res = await fetch('/api/uploads', { method: 'POST', body: fd });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'upload-failed' }));
        setError(payload.error ?? 'upload-failed');
        return;
      }
      const stored = (await res.json()) as {
        url: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
      };
      setAttachments((prev) => [...prev, stored]);
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    const value = draft.trim();
    if ((!value && attachments.length === 0) || pending || streamingMessageId) return;
    setError(null);
    const localId = `local-${Date.now()}`;
    const assistantLocalId = `assistant-${Date.now()}`;
    const queuedAttachments = attachments;
    const composedPreview = queuedAttachments.length
      ? `${value}${value ? '\n\n' : ''}📎 ${queuedAttachments.map((a) => a.fileName).join(', ')}`
      : value;

    setMessages((prev) => [
      ...prev,
      {
        id: localId,
        role: 'user',
        content: composedPreview,
        createdAt: new Date(),
        requiresConfirmation: false,
      },
      {
        id: assistantLocalId,
        role: 'assistant',
        content: '',
        toolPayload: useReasoning ? { reasoning_content: '' } : undefined,
        createdAt: new Date(),
        requiresConfirmation: false,
      },
    ]);
    setDraft('');
    setAttachments([]);
    setStreamingMessageId(assistantLocalId);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/ai-assistant/${props.sessionId}/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: value,
            useReasoning,
            attachments: queuedAttachments.length
              ? queuedAttachments.map((a) => ({ url: a.url, mimeType: a.mimeType }))
              : undefined,
          }),
        });
        if (!res.ok || !res.body) {
          setError(`ai.stream.http.${res.status}`);
          setMessages((prev) => prev.filter((m) => m.id !== localId && m.id !== assistantLocalId));
          setStreamingMessageId(null);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const handleEvent = (event: StreamEvent) => {
          if (event.type === 'reasoning_delta') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantLocalId
                  ? {
                      ...m,
                      toolPayload: {
                        reasoning_content: `${getReasoningContent(m.toolPayload) ?? ''}${event.text}`,
                      },
                    }
                  : m,
              ),
            );
            return;
          }
          if (event.type === 'content_delta') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantLocalId ? { ...m, content: `${m.content}${event.text}` } : m,
              ),
            );
            return;
          }
          if (event.type === 'error') {
            setError(event.error);
            setMessages((prev) =>
              prev.filter((m) => m.id !== localId && m.id !== assistantLocalId),
            );
            setStreamingMessageId(null);
            return;
          }
          if (event.type === 'done') {
            if (event.messages) {
              setMessages(
                event.messages.map((m) => ({
                  ...m,
                  createdAt: new Date(String(m.createdAt)),
                })),
              );
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantLocalId
                    ? {
                        ...m,
                        id: event.messageId,
                        content: event.reply,
                        toolPayload: event.reasoning
                          ? { reasoning_content: event.reasoning }
                          : m.toolPayload,
                      }
                    : m,
                ),
              );
            }
            setStreamingMessageId(null);
            textareaRef.current?.focus();
          }
        };

        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          buffer += decoder.decode(chunk, { stream: true });
          let sep = buffer.indexOf('\n\n');
          while (sep >= 0) {
            const raw = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            for (const line of raw.split(/\r?\n/)) {
              if (!line.startsWith('data:')) continue;
              handleEvent(JSON.parse(line.slice(5).trim()) as StreamEvent);
            }
            sep = buffer.indexOf('\n\n');
          }
        }
        setStreamingMessageId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setMessages((prev) => prev.filter((m) => m.id !== localId && m.id !== assistantLocalId));
        setStreamingMessageId(null);
      }
    });
  }

  const isSending = pending || Boolean(streamingMessageId);
  const roleLabels: Record<string, string> = {
    user: t('roleUser'),
    assistant: t('roleAssistant'),
    tool: t('roleTool'),
    system: t('roleSystem'),
  };

  if (!props.enabled) {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        {t('disabledWarning')}
      </div>
    );
  }

  return (
    <div className="mt-4 flex h-[calc(100dvh-220px)] flex-col gap-3 rounded-xl border border-brand-cream-3 bg-card">
      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-brand-cream-3 px-3 py-6 text-center text-sm text-brand-ink-3">
            {t('welcomeHint')}
          </div>
        ) : null}
        {messages.map((m) => {
          const isTool = m.role === 'tool';
          const draftHint = isTool ? extractDraftHint(m.toolPayload) : null;

          if (isTool && draftHint) {
            return (
              <div key={m.id} className="max-w-[85%]">
                <ConfirmActionCard
                  draftId={draftHint.draftId}
                  kind={draftHint.kind}
                  summary={draftHint.summary}
                  expiresAt={draftHint.expiresAt}
                />
              </div>
            );
          }

          const bubbleClass = isTool
            ? 'bg-brand-cream-3/70 text-brand-ink-2 text-xs border border-brand-cream-3'
            : m.role === 'user'
              ? 'ml-auto bg-brand-red/10 text-brand-ink'
              : m.role === 'assistant'
                ? 'bg-brand-cream-2 text-brand-ink'
                : 'bg-brand-cream-3 text-brand-ink-2';
          const reasoning = m.role === 'assistant' ? getReasoningContent(m.toolPayload) : null;
          return (
            <div key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${bubbleClass}`}>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-brand-ink-3">
                {isTool && m.toolName
                  ? t('toolLabel', { tool: m.toolName })
                  : (roleLabels[m.role] ?? m.role)}
              </div>
              {isTool ? (
                <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-snug">
                  {summariseToolPayload(m.toolPayload ?? m.content, t('toolError'))}
                </pre>
              ) : (
                <div className="flex flex-col gap-2">
                  {reasoning ? (
                    <details className="group mt-1" open={streamingMessageId === m.id}>
                      <summary className="cursor-pointer text-xs font-semibold text-brand-ink-3 transition-colors hover:text-brand-ink-2">
                        {t('reasoningLabel')}
                      </summary>
                      <div className="mt-2 border-l-2 border-brand-cream-3 pl-3 text-xs italic leading-relaxed text-brand-ink-3">
                        {reasoning}
                      </div>
                    </details>
                  ) : null}
                  <div className="prose prose-sm max-w-none leading-relaxed prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-2 prose-pre:p-2 prose-pre:bg-brand-cream-1 prose-pre:text-brand-ink prose-pre:border-brand-cream-3 prose-pre:border">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                </div>
              )}
              {m.requiresConfirmation ? (
                <div className="mt-2 text-xs text-amber-700">⏳ {t('waitConfirm')}</div>
              ) : null}
            </div>
          );
        })}
        {isSending ? (
          <div className="max-w-[80%] rounded-lg bg-brand-cream-2 px-3 py-2 text-sm text-brand-ink-2">
            <span className="inline-block animate-pulse">{t('aiTyping')}</span>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mx-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <div className="mx-4 flex flex-wrap gap-2 text-xs">
          {attachments.map((a, idx) => (
            <span
              key={a.url}
              className="inline-flex items-center gap-2 rounded-md border border-brand-cream-3 bg-brand-cream-2 px-2 py-1"
            >
              📎 {a.fileName}
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="text-rose-500 hover:text-rose-700"
                aria-label={t('delete')}
                title={t('delete')}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <form
        className="border-t border-brand-cream-3 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder={t('placeholder')}
          rows={2}
          className="w-full resize-none rounded-lg border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
          maxLength={8000}
          disabled={isSending}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-brand-ink-2">
              <input
                type="checkbox"
                checked={useReasoning}
                onChange={(e) => setUseReasoning(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
              />
              {t('reasoningMode')}
            </label>
            <label className="flex items-center gap-2 text-xs text-brand-ink-2">
              <input
                type="checkbox"
                checked={allowWebSearch}
                disabled={webSearchBusy}
                onChange={async (e) => {
                  const next = e.target.checked;
                  setWebSearchBusy(true);
                  setAllowWebSearch(next);
                  const result = await toggleSessionWebSearchAction(props.sessionId, next);
                  setWebSearchBusy(false);
                  if (!result.ok) {
                    setAllowWebSearch(!next);
                    setError(result.error ?? t('failedUpload'));
                  }
                }}
                className="h-3.5 w-3.5 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
              />
              {t('allowWebSearch')}
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isSending}
              className="inline-flex items-center gap-1.5 rounded border border-brand-cream-3 px-2 py-1 text-xs text-brand-ink-2 hover:bg-brand-cream-2 disabled:opacity-50"
            >
              {uploading ? (
                t('uploading')
              ) : (
                <>
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-brand-ink-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                    />
                  </svg>{' '}
                  {t('attachReceipt')}{' '}
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFile}
              className="hidden"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={isSending || (!draft.trim() && attachments.length === 0)}
          >
            {isSending ? t('sending') : t('send')}
          </Button>
        </div>
      </form>
    </div>
  );
}
