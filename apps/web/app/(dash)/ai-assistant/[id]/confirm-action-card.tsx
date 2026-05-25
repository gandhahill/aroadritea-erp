'use client';

/**
 * <ConfirmActionCard /> — T-0172 (Phase 3).
 *
 * Renders inside the chat history when a tool message carries a
 * `draft_id`. The user can click "Setujui & Posting" → calls
 * `confirmDraftAction(draftId)`, which re-checks the *target* service's
 * permission and dispatches to the real commit (manual_sales,
 * complaint, etc). They can also click "Batal" to mark the draft
 * cancelled.
 *
 * The card never carries the payload back to the server — only the
 * `draftId`. The server re-fetches the validated payload from the
 * `ai_action_drafts` row so the client can't tamper with values
 * between proposal and commit.
 */

import { Button } from '@erp/ui';
import { useState, useTransition } from 'react';
import { cancelDraftAction, confirmDraftAction } from '../actions';

interface Props {
  draftId: string;
  kind: string;
  summary: string;
  expiresAt: string;
  initialStatus?: 'pending' | 'committed' | 'cancelled' | 'expired';
  onCommitted?: (result: { draftId: string; resultRef: string; kind: string }) => void;
}

export function ConfirmActionCard(props: Props) {
  const [status, setStatus] = useState<'pending' | 'committed' | 'cancelled' | 'expired'>(
    props.initialStatus ?? 'pending',
  );
  const [resultRef, setResultRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function commit() {
    setError(null);
    startTransition(async () => {
      const r = await confirmDraftAction(props.draftId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setStatus('committed');
      setResultRef(r.resultRef);
      props.onCommitted?.({ draftId: props.draftId, resultRef: r.resultRef, kind: r.kind });
    });
  }

  function cancel() {
    setError(null);
    startTransition(async () => {
      const r = await cancelDraftAction(props.draftId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setStatus('cancelled');
    });
  }

  const expiresInMinutes = Math.max(
    0,
    Math.round((new Date(props.expiresAt).getTime() - Date.now()) / 60_000),
  );

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
        <span>🤝 Persetujuan diperlukan</span>
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] text-amber-800">
          {props.kind.replace(/_/g, ' ')}
        </span>
        {status === 'pending' ? (
          <span className="ml-auto text-[10px] font-normal text-amber-700">
            kedaluwarsa {expiresInMinutes} mnt
          </span>
        ) : null}
      </div>

      <pre className="mb-3 whitespace-pre-wrap rounded-lg bg-white/60 px-3 py-2 text-xs leading-relaxed text-brand-ink">
        {props.summary}
      </pre>

      {error ? (
        <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      {status === 'pending' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary" onClick={commit} disabled={busy}>
            {busy ? 'Memproses…' : 'Setujui & Posting'}
          </Button>
          <Button size="sm" variant="secondary" onClick={cancel} disabled={busy}>
            Batal
          </Button>
          <span className="text-[11px] text-brand-ink-3">
            Permission akan dicek ulang di server sebelum eksekusi.
          </span>
        </div>
      ) : status === 'committed' ? (
        <div className="text-xs text-emerald-700">
          ✅ Diposting. Referensi: <span className="font-mono">{resultRef ?? '—'}</span>
        </div>
      ) : status === 'cancelled' ? (
        <div className="text-xs text-brand-ink-3">↩️ Dibatalkan.</div>
      ) : (
        <div className="text-xs text-brand-ink-3">⌛ Kedaluwarsa — minta AI buat draft baru.</div>
      )}
    </div>
  );
}
