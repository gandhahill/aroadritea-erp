'use server';

import { getSession } from '@/lib/auth';
import { getDocsContent, replaceDocsContent } from '@erp/services/cms';
import { requirePermission } from '@erp/services/iam';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';
import {
  type EditableDocsContent,
  getDefaultEditableDocs,
  normalizeEditableDocs,
} from '../../docs/editable-docs';

type ActionState = {
  ok: boolean;
  message?: string;
};

function buildCtx(session: Awaited<ReturnType<typeof getSession>>): AuditContext {
  const user = session?.user as Record<string, unknown> | null;
  return {
    userId: (user?.id as string) ?? 'system',
    tenantId: (user?.tenantId as string) ?? 'default',
    locationId: (user?.locationId as string) ?? 'default',
  };
}

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function isDocsLocale(value: FormDataEntryValue): value is 'id' | 'en' | 'zh' {
  return value === 'id' || value === 'en' || value === 'zh';
}

function buildSubmittedContent(formData: FormData, defaults: EditableDocsContent) {
  return {
    id: {
      title: getText(formData, 'title_id') || defaults.id.title,
      subtitle: getText(formData, 'subtitle_id') || defaults.id.subtitle,
      body: getText(formData, 'body_id') || defaults.id.body,
    },
    en: {
      title: getText(formData, 'title_en') || defaults.en.title,
      subtitle: getText(formData, 'subtitle_en') || defaults.en.subtitle,
      body: getText(formData, 'body_en') || defaults.en.body,
    },
    zh: {
      title: getText(formData, 'title_zh') || defaults.zh.title,
      subtitle: getText(formData, 'subtitle_zh') || defaults.zh.subtitle,
      body: getText(formData, 'body_zh') || defaults.zh.body,
    },
  } satisfies EditableDocsContent;
}

export async function fetchDocsEditorContent(): Promise<EditableDocsContent> {
  const session = await getSession();
  if (!session) return getDefaultEditableDocs();
  const ctx = buildCtx(session);
  const setting = await getDocsContent(ctx.tenantId);
  return normalizeEditableDocs(setting.ok ? setting.value?.value : null);
}

export async function saveDocsEditorContent(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'docs.editor.unauthorized' };
  const ctx = buildCtx(session);
  const perm = await requirePermission(ctx.userId, 'docs.edit');
  if (!perm.ok) return { ok: false, message: 'docs.editor.forbidden' };
  const defaults = getDefaultEditableDocs();
  const content = buildSubmittedContent(formData, defaults);
  const intent = getText(formData, '_intent') || 'save';

  if (intent === 'refresh_defaults') {
    const locales = formData.getAll('refresh_locale').filter(isDocsLocale);
    if (locales.length === 0) {
      return { ok: false, message: 'docs.editor.selectRefreshLocale' };
    }
    for (const locale of locales) {
      content[locale] = defaults[locale];
    }
    const result = await replaceDocsContent(
      {
        tenantId: ctx.tenantId,
        content,
        reason: `Refresh docs defaults for locales: ${locales.join(', ')}`,
      },
      ctx,
    );
    if (!result.ok) return { ok: false, message: 'docs.editor.saveFailed' };

    revalidatePath('/docs');
    revalidatePath('/cms/docs');
    return { ok: true, message: 'docs.editor.refreshed' };
  }

  const result = await replaceDocsContent(
    {
      tenantId: ctx.tenantId,
      content,
      reason: 'Manual docs editor save',
    },
    ctx,
  );
  if (!result.ok) return { ok: false, message: 'docs.editor.saveFailed' };

  revalidatePath('/docs');
  revalidatePath('/cms/docs');
  return { ok: true, message: 'docs.editor.saved' };
}
