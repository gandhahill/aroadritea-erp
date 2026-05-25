'use client';

import { Button, Input } from '@erp/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { archiveSessionAction, renameSessionAction, startSessionAction } from './actions';
import { useTranslations } from 'next-intl';

interface SessionRow {
  id: string;
  title: string;
  status: string;
  ownerUserId: string;
  updatedAt: Date;
}

interface Props {
  enabled: boolean;
  canAdmin: boolean;
  ownSessions: SessionRow[];
  allSessions: SessionRow[];
  ownError: string | null;
  adminError: string | null;
}

export function AiAssistantClient(props: Props) {
  const router = useRouter();
  const [_busy, startTransition] = useTransition();
  const [newTitle, setNewTitle] = useState('');
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const t = useTranslations('aiAssistantLanding');
  const t_ai = useTranslations('ai');

  if (!props.enabled) {
    return (
      <div className="rounded-xl border border-dashed border-brand-cream-3 bg-card p-10 text-center text-sm text-brand-ink-3">
        {t('disabled')}
      </div>
    );
  }

  async function handleStart() {
    const result = await startSessionAction({ title: newTitle.trim() || undefined });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    startTransition(() => router.push(`/ai-assistant/${result.id}`));
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    const result = await renameSessionAction(id, renameValue.trim());
    setRenameId(null);
    setRenameValue('');
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    router.refresh();
  }

  async function handleArchive(id: string) {
    const result = await archiveSessionAction(id);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    router.refresh();
  }

  const list = tab === 'mine' ? props.ownSessions : props.allSessions;
  const error = tab === 'mine' ? props.ownError : props.adminError;

  return (
    <div className="space-y-4">
      {notice ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {notice === 'ai.provider.notConfigured' ? t_ai('provider.notConfigured') : notice}
        </div>
      ) : null}

      <section className="rounded-xl border border-brand-cream-3 bg-card p-4">
        <h2 className="text-sm font-semibold text-brand-ink">{t('startNew')}</h2>
        <p className="text-xs text-brand-ink-3">
          {t('policy')}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
            maxLength={200}
            className="flex-1"
          />
          <Button variant="primary" size="md" onClick={handleStart}>
            {t('btnNewSession')}
          </Button>
        </div>
      </section>

      {props.canAdmin ? (
        <nav className="flex gap-2 border-b border-brand-cream-3 pb-px">
          {(['mine', 'all'] as const).map((t_tab) => (
            <button
              key={t_tab}
              type="button"
              onClick={() => setTab(t_tab)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium ${
                tab === t_tab
                  ? 'border-b-2 border-brand-red text-brand-red'
                  : 'text-brand-ink-2 hover:text-brand-ink'
              }`}
            >
              {t_tab === 'mine' ? t('tabMine') : t('tabAll')}
            </button>
          ))}
        </nav>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {error === 'ai.provider.notConfigured' ? t_ai('provider.notConfigured') : error}
        </div>
      ) : null}

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-cream-3 bg-card p-10 text-center text-sm text-brand-ink-3">
          {t('empty')}
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-brand-cream-3 bg-card p-4 transition hover:border-brand-red/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {renameId === row.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={renameValue}
                        autoFocus
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(row.id);
                          if (e.key === 'Escape') {
                            setRenameId(null);
                            setRenameValue('');
                          }
                        }}
                        className="flex-1"
                      />
                      <Button size="sm" variant="primary" onClick={() => handleRename(row.id)}>
                        {t('btnSave')}
                      </Button>
                    </div>
                  ) : (
                    <a
                      href={`/ai-assistant/${row.id}`}
                      className="text-sm font-medium text-brand-ink hover:underline"
                    >
                      {row.title}
                    </a>
                  )}
                  <p className="mt-1 text-xs text-brand-ink-3">
                    {props.canAdmin && tab === 'all' ? `${t('owner')}: ${row.ownerUserId} · ` : ''}
                    {row.status} · {new Date(row.updatedAt).toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="flex gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setRenameId(row.id);
                      setRenameValue(row.title);
                    }}
                    className="rounded border border-brand-cream-3 px-2 py-1 text-brand-ink-2 hover:bg-brand-cream-2"
                  >
                    {t('btnRename')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(row.id)}
                    className="rounded border border-rose-200 px-2 py-1 text-rose-600 hover:bg-rose-50"
                  >
                    {t('btnArchive')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
