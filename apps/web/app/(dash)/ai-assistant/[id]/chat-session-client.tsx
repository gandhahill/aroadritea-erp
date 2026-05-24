'use client';

import { Button } from '@erp/ui';
import { useEffect, useRef, useState, useTransition } from 'react';
import { sendMessageAction } from '../actions';

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  requiresConfirmation: boolean;
}

interface Props {
  enabled: boolean;
  sessionId: string;
  initialMessages: Message[];
}

export function ChatSessionClient(props: Props) {
  const [messages, setMessages] = useState<Message[]>(props.initialMessages);
  const [draft, setDraft] = useState('');
  const [useReasoning, setUseReasoning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  async function submit() {
    const value = draft.trim();
    if (!value || pending) return;
    setError(null);
    const localId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: localId,
        role: 'user',
        content: value,
        createdAt: new Date(),
        requiresConfirmation: false,
      },
    ]);
    setDraft('');

    startTransition(async () => {
      const result = await sendMessageAction({
        sessionId: props.sessionId,
        content: value,
        useReasoning,
      });
      if (!result.ok) {
        setError(result.error);
        // Roll back the optimistic user message so the user can retry.
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
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-auto bg-brand-red/10 text-brand-ink'
                : m.role === 'assistant'
                  ? 'bg-brand-cream-2 text-brand-ink'
                  : 'bg-brand-cream-3 text-brand-ink-2'
            }`}
          >
            <div className="mb-1 text-[10px] uppercase tracking-wide text-brand-ink-3">
              {m.role}
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
            {m.requiresConfirmation ? (
              <div className="mt-2 text-xs text-amber-700">
                ⏳ Menunggu konfirmasi Anda sebelum AI mengeksekusi tindakan.
              </div>
            ) : null}
          </div>
        ))}
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
        <div className="mt-2 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-brand-ink-2">
            <input
              type="checkbox"
              checked={useReasoning}
              onChange={(e) => setUseReasoning(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
            />
            Mode penalaran (lebih lambat, lebih akurat)
          </label>
          <Button variant="primary" size="sm" type="submit" disabled={pending || !draft.trim()}>
            {pending ? 'Mengirim…' : 'Kirim'}
          </Button>
        </div>
      </form>
    </div>
  );
}
