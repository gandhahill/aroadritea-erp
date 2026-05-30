import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchMcpTokens } from './actions';
import { McpTokensClient } from './mcp-tokens-client';

export const metadata: Metadata = {
  title: 'MCP Tokens',
};

export default async function McpTokensPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [tokens, t] = await Promise.all([
    fetchMcpTokens(),
    getTranslations('settings.mcpTokens'),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />
      <McpTokensClient tokens={tokens} />
    </div>
  );
}
