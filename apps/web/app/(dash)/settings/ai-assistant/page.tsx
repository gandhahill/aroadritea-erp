import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getAiRuntimeConfig, loadProviderConfig } from '@erp/services/ai';
import { can } from '@erp/services/iam';
import { Button } from '@erp/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { saveAiRuntimeSettingsAction } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ai.settings');
  return { title: `${t('title')}` };
}

export default async function AiAssistantSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  if (!(await can(userId, 'ai.assistant.admin'))) notFound();

  const [t, params] = await Promise.all([getTranslations('ai.settings'), searchParams]);
  const config = await getAiRuntimeConfig(tenantId);
  const secretConfigured = Boolean(loadProviderConfig().apiKey);

  const fieldClass =
    'mt-1 h-10 w-full rounded-md border border-brand-cream-3 bg-brand-cream px-3 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20';

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {params.saved ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {t('saved')}
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {params.error}
        </div>
      ) : null}

      <div className="rounded-xl border border-brand-cream-3 bg-card p-4 text-sm text-brand-ink-2">
        {secretConfigured ? t('secretConfigured') : t('secretMissing')}
      </div>

      <form
        action={saveAiRuntimeSettingsAction}
        className="space-y-4 rounded-xl border border-brand-cream-3 bg-card p-4"
      >
        <label className="flex items-center gap-2 text-sm font-medium text-brand-ink">
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={config.enabled}
            className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
          />
          {t('enabled')}
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-brand-ink">
            {t('baseUrl')}
            <input name="baseUrl" defaultValue={config.baseUrl} className={fieldClass} />
          </label>
          <label className="text-sm font-medium text-brand-ink">
            {t('model')}
            <input name="model" defaultValue={config.model} className={fieldClass} />
          </label>
          <label className="text-sm font-medium text-brand-ink">
            {t('reasoningModel')}
            <input
              name="reasoningModel"
              defaultValue={config.reasoningModel}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium text-brand-ink">
            {t('temperature')}
            <input
              name="temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              defaultValue={config.temperature}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium text-brand-ink">
            {t('maxTokens')}
            <input
              name="maxTokens"
              type="number"
              min="128"
              max="16000"
              defaultValue={config.maxTokens}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium text-brand-ink">
            {t('hourlyCap')}
            <input
              name="hourlyCap"
              type="number"
              min="1"
              max="500"
              defaultValue={config.hourlyCap}
              className={fieldClass}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-brand-ink">
          <input
            name="supportsVision"
            type="checkbox"
            defaultChecked={config.supportsVision}
            className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
          />
          {t('supportsVision')}
        </label>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="md">
            {t('save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
