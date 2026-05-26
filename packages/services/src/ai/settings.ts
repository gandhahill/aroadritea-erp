import { and, db, eq } from '@erp/db';
import { cmsSettings } from '@erp/db/schema/cms';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

export const AI_RUNTIME_SETTING_KEY = 'ai.provider.config';

const DEFAULT_AI_RUNTIME_CONFIG = {
  enabled: true,
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-v4-flash',
  reasoningModel: 'deepseek-v4-pro',
  temperature: 0.4,
  maxTokens: 2048,
  hourlyCap: 30,
  supportsVision: false,
};

export const AiRuntimeConfigSchema = z.object({
  enabled: z.boolean().default(DEFAULT_AI_RUNTIME_CONFIG.enabled),
  baseUrl: z.string().url().default(DEFAULT_AI_RUNTIME_CONFIG.baseUrl),
  model: z.string().min(1).max(100).default(DEFAULT_AI_RUNTIME_CONFIG.model),
  reasoningModel: z.string().min(1).max(100).default(DEFAULT_AI_RUNTIME_CONFIG.reasoningModel),
  temperature: z.number().min(0).max(2).default(DEFAULT_AI_RUNTIME_CONFIG.temperature),
  maxTokens: z.number().int().min(128).max(16000).default(DEFAULT_AI_RUNTIME_CONFIG.maxTokens),
  hourlyCap: z.number().int().min(1).max(500).default(DEFAULT_AI_RUNTIME_CONFIG.hourlyCap),
  supportsVision: z.boolean().default(DEFAULT_AI_RUNTIME_CONFIG.supportsVision),
});

export type AiRuntimeConfig = z.infer<typeof AiRuntimeConfigSchema>;

export async function getAiRuntimeConfig(tenantId: string): Promise<AiRuntimeConfig> {
  const [row] = await db
    .select({ value: cmsSettings.value })
    .from(cmsSettings)
    .where(and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, AI_RUNTIME_SETTING_KEY)))
    .limit(1);
  const parsed = AiRuntimeConfigSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : DEFAULT_AI_RUNTIME_CONFIG;
}

export async function updateAiRuntimeConfig(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<AiRuntimeConfig>> {
  const perm = await requirePermission(ctx.userId, 'ai.assistant.admin');
  if (!perm.ok) return perm;

  const parsed = AiRuntimeConfigSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(AppError.validation('ai.settings.invalid', { detail: parsed.error.message }));
  }

  const before = await getAiRuntimeConfig(ctx.tenantId);
  const now = new Date();
  await db
    .insert(cmsSettings)
    .values({
      id: generateId(),
      tenantId: ctx.tenantId,
      key: AI_RUNTIME_SETTING_KEY,
      value: parsed.data,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [cmsSettings.tenantId, cmsSettings.key],
      set: {
        value: parsed.data,
        updatedBy: ctx.userId,
        updatedAt: now,
      },
    });

  await auditRecord({
    action: 'update',
    entityType: 'ai_provider_config',
    entityId: AI_RUNTIME_SETTING_KEY,
    before,
    after: parsed.data,
    ctx,
  });

  return ok(parsed.data);
}
