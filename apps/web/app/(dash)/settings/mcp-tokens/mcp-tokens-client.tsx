'use client';

import { useTranslations } from 'next-intl';

interface McpToken {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export function McpTokensClient({ tokens }: { tokens: McpToken[] }) {
  const t = useTranslations('settings.mcpTokens');
  return (
    <div className="overflow-hidden border-brand-cream-3 rounded-xl border bg-card text-card-foreground shadow">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-brand-cream-2 text-brand-ink-2">
            <tr>
              <th className="px-4 py-3 font-semibold">{t('name')}</th>
              <th className="px-4 py-3 font-semibold">{t('createdAt')}</th>
              <th className="px-4 py-3 font-semibold">{t('lastUsedAt')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3">
            {tokens.map((token) => (
              <tr key={token.id} className="hover:bg-brand-cream-2/50">
                <td className="px-4 py-3 font-medium text-brand-ink">{token.name}</td>
                <td className="px-4 py-3 text-brand-ink-2">{new Date(token.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-brand-ink-2">{token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
            {tokens.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-brand-ink-3">
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
