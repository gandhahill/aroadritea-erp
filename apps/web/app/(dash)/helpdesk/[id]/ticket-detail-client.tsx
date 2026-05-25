'use client';

import type { TicketDetail } from '@erp/services/helpdesk';
import { Button } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { replyTicketAction, setTicketStatusAction } from '../actions';

interface Props {
  ticket: TicketDetail;
  canHandle: boolean;
  currentUserId: string;
}

export function TicketDetailClient({ ticket, canHandle, currentUserId }: Props) {
  const t = useTranslations('helpdesk');
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function sendReply() {
    setError(null);
    if (reply.trim().length < 1) {
      setError(t('replyRequired'));
      return;
    }
    startTransition(async () => {
      const res = await replyTicketAction({
        ticketId: ticket.id,
        body: reply.trim(),
        isInternal: internal,
      });
      if (!res.ok) {
        setError(res.error ?? 'Error');
        return;
      }
      setReply('');
      setInternal(false);
      router.refresh();
    });
  }

  function transition(to: 'in_progress' | 'resolved' | 'closed' | 'open') {
    startTransition(async () => {
      const res = await setTicketStatusAction(ticket.id, to);
      if (!res.ok) {
        setError(res.error ?? 'Error');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Meta */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Meta label={t('table.status')} value={t(`status.${ticket.status}` as 'status.open')} />
        <Meta
          label={t('table.priority')}
          value={t(`priority.${ticket.priority}` as 'priority.normal')}
        />
        <Meta
          label={t('table.category')}
          value={t(`category.${ticket.category}` as 'category.other')}
        />
        <Meta label={t('table.assignee')} value={ticket.assigneeName ?? '—'} />
      </div>

      {/* Body */}
      <div className="rounded-xl border border-brand-cream-3 bg-card p-4">
        <h2 className="text-sm font-semibold text-brand-ink">{t('details')}</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-brand-ink-2">{ticket.body}</p>
        {ticket.context && Object.keys(ticket.context).length > 0 ? (
          <details className="mt-3 rounded border border-brand-cream-3 bg-brand-cream-1 p-2 text-xs">
            <summary className="cursor-pointer font-semibold text-brand-ink-2">
              {t('contextSection')}
            </summary>
            <pre className="mt-1 overflow-x-auto text-[11px] text-brand-ink-3">
              {JSON.stringify(ticket.context, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>

      {/* Status transitions */}
      {canHandle ? (
        <div className="flex flex-wrap gap-2 rounded-xl border border-brand-cream-3 bg-card p-3">
          {ticket.status !== 'in_progress' ? (
            <Button
              variant="secondary"
              size="md"
              disabled={pending}
              onClick={() => transition('in_progress')}
            >
              {t('actions.inProgress')}
            </Button>
          ) : null}
          {ticket.status !== 'resolved' ? (
            <Button
              variant="primary"
              size="md"
              disabled={pending}
              onClick={() => transition('resolved')}
            >
              {t('actions.resolve')}
            </Button>
          ) : null}
          {ticket.status !== 'closed' ? (
            <Button
              variant="secondary"
              size="md"
              disabled={pending}
              onClick={() => transition('closed')}
            >
              {t('actions.close')}
            </Button>
          ) : null}
          {ticket.status === 'closed' || ticket.status === 'resolved' ? (
            <Button
              variant="secondary"
              size="md"
              disabled={pending}
              onClick={() => transition('open')}
            >
              {t('actions.reopen')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Replies */}
      <div className="rounded-xl border border-brand-cream-3 bg-card">
        <header className="border-b border-brand-cream-3 px-4 py-3">
          <h2 className="text-sm font-semibold text-brand-ink">{t('thread')}</h2>
        </header>
        <ul className="divide-y divide-brand-cream-3">
          {ticket.replies.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-brand-ink-3">{t('noReplies')}</li>
          ) : (
            ticket.replies.map((r) => (
              <li
                key={r.id}
                className={`px-4 py-3 ${
                  r.isInternal
                    ? 'bg-amber-50'
                    : r.authorUserId === currentUserId
                      ? 'bg-brand-cream-1/30'
                      : ''
                }`}
              >
                <div className="flex items-center justify-between text-xs text-brand-ink-3">
                  <span className="font-semibold text-brand-ink-2">
                    {r.authorName ?? r.authorUserId}
                    {r.isInternal ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                        {t('internal')}
                      </span>
                    ) : null}
                  </span>
                  <span>{r.createdAt.slice(0, 16).replace('T', ' ')}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-brand-ink-2">{r.body}</p>
              </li>
            ))
          )}
        </ul>

        {ticket.status !== 'closed' ? (
          <div className="border-t border-brand-cream-3 p-3 space-y-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              placeholder={t('replyPlaceholder')}
              maxLength={5000}
              className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm"
            />
            {canHandle ? (
              <label className="flex items-center gap-2 text-xs text-brand-ink-3">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                />
                {t('internalNote')}
              </label>
            ) : null}
            {error ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                {error}
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button variant="primary" size="md" disabled={pending} onClick={sendReply}>
                {t('sendReply')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-cream-3 bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-brand-ink-3">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-brand-ink">{value}</p>
    </div>
  );
}
