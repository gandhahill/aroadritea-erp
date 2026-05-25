'use client';

/**
 * <SessionsSection /> — T-0176.
 *
 * Lists every active session the current user owns and exposes
 * one-click revocation for any session that is NOT the current
 * browser. Also offers a "log out everywhere else" bulk action which
 * is the right move after, say, finding out a laptop was lost.
 *
 * All copy goes through next-intl `account.sessions.*` keys
 * (id/en/zh).
 */

import { Button } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { revokeAllOtherSessionsAction, revokeSessionAction } from './actions';

interface SessionRow {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

interface Props {
  sessions: SessionRow[];
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

function summariseUserAgent(ua: string | null): string {
  if (!ua) return '—';
  // Very small heuristic so the row is readable without bundling a UA parser.
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  if (/Mobile|Android|iPhone/.test(ua)) return 'Mobile';
  return ua.slice(0, 64);
}

export function SessionsSection({ sessions }: Props) {
  const t = useTranslations('account.sessions');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'info' | 'error';
    text: string;
  } | null>(null);

  function revoke(id: string) {
    setFeedback(null);
    startTransition(async () => {
      const result = await revokeSessionAction(id);
      if (!result.ok) {
        setFeedback({ type: 'error', text: t(`errors.${result.error ?? 'unknown'}`) });
        return;
      }
      setConfirmRevokeId(null);
      setFeedback({ type: 'info', text: t('revoked') });
      router.refresh();
    });
  }

  function revokeAll() {
    setFeedback(null);
    startTransition(async () => {
      const result = await revokeAllOtherSessionsAction();
      if (!result.ok) {
        setFeedback({ type: 'error', text: t(`errors.${result.error ?? 'unknown'}`) });
        return;
      }
      setConfirmRevokeAll(false);
      setFeedback({
        type: 'info',
        text: t('revokedAll', { count: result.revoked ?? 0 }),
      });
      router.refresh();
    });
  }

  const others = sessions.filter((s) => !s.isCurrent);

  return (
    <section className="rounded-xl border border-brand-cream-3 bg-card p-4">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-brand-ink">{t('title')}</h2>
          <p className="text-xs text-brand-ink-3">{t('description')}</p>
        </div>
        {others.length > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfirmRevokeAll(true)}
            disabled={pending}
          >
            {t('logoutEverywhere')}
          </Button>
        ) : null}
      </header>

      {feedback ? (
        <div
          className={`mb-3 rounded-md border px-3 py-2 text-xs ${
            feedback.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <p className="text-sm text-brand-ink-3">{t('empty')}</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream-2/40 px-3 py-2"
            >
              <div className="min-w-0 text-sm">
                <div className="font-medium text-brand-ink">
                  {summariseUserAgent(s.userAgent)}
                  {s.isCurrent ? (
                    <span className="ml-2 rounded-full bg-brand-jade/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-jade">
                      {t('thisDevice')}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-brand-ink-3">
                  {t('ipLabel')}: {s.ipAddress ?? '—'} · {t('createdLabel')}:{' '}
                  {fmtDateTime(s.createdAt)}
                </div>
                <div className="text-[11px] text-brand-ink-3">
                  {t('expiresLabel')}: {fmtDateTime(s.expiresAt)}
                </div>
              </div>
              {!s.isCurrent ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmRevokeId(s.id)}
                  disabled={pending}
                >
                  {t('revoke')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {confirmRevokeId ? (
        <ConfirmModal
          title={t('confirmRevokeTitle')}
          body={t('confirmRevokeBody')}
          confirmLabel={t('revoke')}
          cancelLabel={t('cancel')}
          pending={pending}
          onConfirm={() => revoke(confirmRevokeId)}
          onCancel={() => setConfirmRevokeId(null)}
        />
      ) : null}
      {confirmRevokeAll ? (
        <ConfirmModal
          title={t('confirmRevokeAllTitle')}
          body={t('confirmRevokeAllBody')}
          confirmLabel={t('logoutEverywhere')}
          cancelLabel={t('cancel')}
          pending={pending}
          onConfirm={revokeAll}
          onCancel={() => setConfirmRevokeAll(false)}
        />
      ) : null}
    </section>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-brand-cream-3 bg-card p-5 shadow-2xl">
        <h3 className="text-sm font-semibold text-brand-ink">{title}</h3>
        <p className="mt-2 text-sm text-brand-ink-3">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
