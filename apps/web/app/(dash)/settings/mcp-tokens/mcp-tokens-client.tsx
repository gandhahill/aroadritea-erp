'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from '@erp/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { createMcpTokenAction, revokeMcpTokenAction } from './actions';

interface McpToken {
  id: string;
  name: string;
  createdAt: Date | string;
  lastUsedAt: Date | string | null;
  expiresAt: Date | string | null;
  revokedAt: Date | string | null;
}

function fmt(d: Date | string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString();
}

export function McpTokensClient({ tokens }: { tokens: McpToken[] }) {
  const t = useTranslations('settings.mcpTokens');
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  function create() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createMcpTokenAction(name.trim());
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setNewToken(res.token);
      setName('');
      router.refresh();
    });
  }

  function confirmRevoke() {
    const id = revokeId;
    if (!id) return;
    setRevokeId(null);
    startTransition(async () => {
      const res = await revokeMcpTokenAction(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t('revoke.success'));
      router.refresh();
    });
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function statusOf(token: McpToken): { label: string; cls: string } {
    if (token.revokedAt) return { label: t('status.revoked'), cls: 'bg-rose-500/10 text-rose-600' };
    if (token.expiresAt && new Date(token.expiresAt) < new Date())
      return { label: t('status.expired'), cls: 'bg-brand-ink-3/10 text-brand-ink-3' };
    return { label: t('status.active'), cls: 'bg-brand-jade/10 text-brand-jade' };
  }

  return (
    <div className="space-y-5">
      {/* Create */}
      <section className="surface-card p-5">
        <h2 className="text-base font-semibold text-brand-ink">{t('create.title')}</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="grid w-full gap-1 sm:w-80">
            <label className="text-xs font-semibold text-brand-ink-2">{t('name')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('create.namePlaceholder')}
              className="h-9 w-full rounded-md border border-brand-cream-3 bg-card px-2.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={create}
            disabled={pending || !name.trim()}
            className="h-9 rounded-md bg-brand-red px-4 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
          >
            {pending ? t('create.creating') : t('create.button')}
          </button>
        </div>

        {newToken && (
          <div className="mt-4 rounded-lg border border-brand-jade/30 bg-brand-jade-light/50 p-4">
            <p className="text-sm font-semibold text-brand-ink">{t('created.title')}</p>
            <p className="mt-1 text-xs text-brand-ink-2">{t('created.hint')}</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded border border-brand-cream-3 bg-card px-3 py-2 font-mono text-xs text-brand-ink">
                {newToken}
              </code>
              <button
                type="button"
                onClick={copyToken}
                className="h-8 shrink-0 rounded-md border border-brand-jade/40 px-3 text-xs font-semibold text-brand-jade hover:bg-brand-jade/10"
              >
                {copied ? t('created.copied') : t('created.copy')}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setNewToken(null)}
              className="mt-3 text-xs font-semibold text-brand-ink-3 underline-offset-2 hover:underline"
            >
              {t('created.done')}
            </button>
          </div>
        )}
      </section>

      {/* List */}
      <div className="overflow-hidden border-brand-cream-3 rounded-xl border bg-card text-card-foreground shadow">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-brand-cream-2 text-brand-ink-2">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('name')}</th>
                <th className="px-4 py-3 font-semibold">{t('createdAt')}</th>
                <th className="px-4 py-3 font-semibold">{t('lastUsedAt')}</th>
                <th className="px-4 py-3 font-semibold">{t('status.label')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3">
              {tokens.map((token) => {
                const status = statusOf(token);
                return (
                  <tr key={token.id} className="hover:bg-brand-cream-2/50">
                    <td className="px-4 py-3 font-medium text-brand-ink">{token.name}</td>
                    <td className="px-4 py-3 text-brand-ink-2">{fmt(token.createdAt)}</td>
                    <td className="px-4 py-3 text-brand-ink-2">{token.lastUsedAt ? fmt(token.lastUsedAt) : t('never')}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!token.revokedAt && (
                        <button
                          type="button"
                          onClick={() => setRevokeId(token.id)}
                          disabled={pending}
                          className="rounded-md border border-brand-cream-3 px-2.5 py-1 text-xs font-semibold text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red disabled:opacity-40"
                        >
                          {t('revoke.button')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {tokens.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-brand-ink-3">
                    {t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {revokeId && (
        <ConfirmDialog
          message={t('revoke.confirm')}
          confirmLabel={t('revoke.button')}
          onConfirm={confirmRevoke}
          onCancel={() => setRevokeId(null)}
        />
      )}
    </div>
  );
}
