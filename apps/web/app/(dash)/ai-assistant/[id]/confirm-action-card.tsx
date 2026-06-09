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
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { cancelDraftAction, confirmDraftAction, fetchDraftAction } from '../actions';

interface Props {
  draftId: string;
  kind: string;
  summary: string;
  expiresAt: string;
  initialStatus?: 'pending' | 'committed' | 'cancelled' | 'expired';
  onCommitted?: (result: { draftId: string; resultRef: string; kind: string }) => void;
}

export function ConfirmActionCard(props: Props) {
  const t = useTranslations('aiAssistantConfirm');
  const [status, setStatus] = useState<'pending' | 'committed' | 'cancelled' | 'expired'>(
    props.initialStatus ?? 'pending',
  );
  const [resultRef, setResultRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    fetchDraftAction(props.draftId).then((r) => {
      if (!alive || !r.ok) return;
      setStatus(r.draft.status);
      setResultRef(r.draft.resultRef ?? null);
    });
    return () => {
      alive = false;
    };
  }, [props.draftId]);

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
        <span>{t('title')}</span>
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] text-amber-800">
          {props.kind.replace(/_/g, ' ')}
        </span>
        {status === 'pending' ? (
          <span className="ml-auto text-[10px] font-normal text-amber-700">
            {t('expires', { minutes: expiresInMinutes })}
          </span>
        ) : null}
      </div>

      <pre className="mb-3 whitespace-pre-wrap rounded-lg bg-card/70 px-3 py-2 text-xs leading-relaxed text-brand-ink">
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
            {busy ? t('processing') : t('approve')}
          </Button>
          <Button size="sm" variant="secondary" onClick={cancel} disabled={busy}>
            {t('cancel')}
          </Button>
          <span className="text-[11px] text-brand-ink-3">{t('permission')}</span>
        </div>
      ) : status === 'committed' ? (
        <div className="text-xs text-emerald-700">
          {t('committed')} <span className="font-mono">{resultRef ?? '-'}</span>
        </div>
      ) : status === 'cancelled' ? (
        <div className="text-xs text-brand-ink-3">{t('cancelled')}</div>
      ) : (
        <div className="text-xs text-brand-ink-3">{t('expired')}</div>
      )}
    </div>
  );
}
