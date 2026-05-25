'use client';

import { Button } from '@erp/ui';
import { useEffect, useRef, useState, useTransition } from 'react';
import { sendMessageAction } from '../actions';
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
  initialMessages: Message[];
}

interface PendingAttachment {
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

function summariseToolPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const p = payload as Record<string, unknown>;
  if (typeof p.call_id === 'string') {
    const inner = (p.payload as { ok?: boolean; output?: unknown; error?: string }) ?? null;
    if (inner) {
      if (inner.ok === false) return `Tool error: ${inner.error}`;
      const outputJson = JSON.stringify(inner.output ?? null);
      return outputJson.length > 500 ? `${outputJson.slice(0, 500)}…` : outputJson;
    }
  }
  return JSON.stringify(p).slice(0, 500);
}

export function ChatSessionClient(props: Props) {
  const [messages, setMessages] = useState<Message[]>(props.initialMessages);
  const [draft, setDraft] = useState('');
  const [useReasoning, setUseReasoning] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages.length]);

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
      setError('Hanya file gambar yang didukung untuk OCR/visual.');
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
    if ((!value && attachments.length === 0) || pending) return;
    setError(null);
    const localId = `local-${Date.now()}`;
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
    ]);
    setDraft('');
    setAttachments([]);

    startTransition(async () => {
      const result = await sendMessageAction({
        sessionId: props.sessionId,
        content: value,
        useReasoning,
        attachments: queuedAttachments.length
          ? queuedAttachments.map((a) => ({ url: a.url, mimeType: a.mimeType }))
          : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        setMessages((prev) => prev.filter((m) => m.id !== localId));
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: result.messageId,
          role: 'assistant',
          content: result.reply,
          createdAt: new Date(),
          requiresConfirmation: false,
        },
      ]);
      textareaRef.current?.focus();
    });
  }

  if (!props.enabled) {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        AI assistant dinonaktifkan. Atur env <code>AI_ASSISTANT_ENABLED=true</code> dan{' '}
        <code>DEEPSEEK_API_KEY</code> untuk mengaktifkan.
      </div>
    );
  }

  return (
    <div className="mt-4 flex h-[calc(100dvh-220px)] flex-col gap-3 rounded-xl border border-brand-cream-3 bg-card">
      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-brand-cream-3 px-3 py-6 text-center text-sm text-brand-ink-3">
            Mulai dengan menulis pertanyaan, mis. <em>"Bagaimana cara input penjualan manual?"</em>
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
          return (
            <div key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${bubbleClass}`}>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-brand-ink-3">
                {isTool && m.toolName ? `tool: ${m.toolName}` : m.role}
              </div>
              {isTool ? (
                <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-snug">
                  {summariseToolPayload(m.toolPayload ?? m.content)}
                </pre>
              ) : (
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              )}
              {m.requiresConfirmation ? (
                <div className="mt-2 text-xs text-amber-700">
                  ⏳ Menunggu konfirmasi Anda sebelum AI mengeksekusi tindakan.
                </div>
              ) : null}
            </div>
          );
        })}
        {pending ? (
          <div className="max-w-[80%] rounded-lg bg-brand-cream-2 px-3 py-2 text-sm text-brand-ink-2">
            <span className="inline-block animate-pulse">…AI sedang mengetik</span>
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
                aria-label={`hapus ${a.fileName}`}
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
          placeholder="Tulis pesan… (Enter untuk kirim, Shift+Enter untuk baris baru)"
          rows={2}
          className="w-full resize-none rounded-lg border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
          maxLength={8000}
          disabled={pending}
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
              Mode penalaran (lebih lambat, lebih akurat)
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || pending}
              className="rounded border border-brand-cream-3 px-2 py-1 text-xs text-brand-ink-2 hover:bg-brand-cream-2 disabled:opacity-50"
            >
              {uploading ? 'Mengunggah…' : '📷 Lampirkan foto struk'}
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
            disabled={pending || (!draft.trim() && attachments.length === 0)}
          >
            {pending ? 'Mengirim…' : 'Kirim'}
          </Button>
        </div>
      </form>
    </div>
  );
}
