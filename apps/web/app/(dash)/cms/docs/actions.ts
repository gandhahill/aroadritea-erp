'use server';

import { getSession } from '@/lib/auth';
import { getSetting, setSetting } from '@erp/services/cms';
import { requirePermission } from '@erp/services/iam';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';
import {
  DOCS_SETTING_KEY,
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

export async function fetchDocsEditorContent(): Promise<EditableDocsContent> {
  const session = await getSession();
  if (!session) return getDefaultEditableDocs();
  const ctx = buildCtx(session);
  const setting = await getSetting(ctx.tenantId, DOCS_SETTING_KEY);
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

  const content: EditableDocsContent = {
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
  };

  const result = await setSetting(ctx.tenantId, DOCS_SETTING_KEY, content, ctx);
  if (!result.ok) return { ok: false, message: 'docs.editor.saveFailed' };

  revalidatePath('/docs');
  revalidatePath('/cms/docs');
  return { ok: true, message: 'docs.editor.saved' };
}
