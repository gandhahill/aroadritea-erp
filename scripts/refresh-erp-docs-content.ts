import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import {
  getDefaultEditableDocs,
  normalizeEditableDocs,
} from '../apps/web/app/(dash)/docs/editable-docs';

type Locale = 'id' | 'en' | 'zh';

const DOCS_SETTING_KEY = 'erp_docs_content';
const VALID_LOCALES = new Set<Locale>(['id', 'en', 'zh']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function readArg(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return undefined;
}

function parseLocales(value: string | undefined): Locale[] {
  if (!value) return ['id', 'en', 'zh'];
  const locales = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const invalid = locales.filter((locale) => !VALID_LOCALES.has(locale as Locale));
  if (invalid.length > 0) {
    throw new Error(`Invalid locale(s): ${invalid.join(', ')}. Use id,en,zh.`);
  }

  return Array.from(new Set(locales as Locale[]));
}

function bodyLength(content: { body: string }) {
  return content.body.length.toLocaleString('id-ID');
}

async function main() {
  const tenantId = readArg('--tenant') ?? 'default';
  const locales = parseLocales(readArg('--locales'));
  const reason = readArg('--reason') ?? `Refresh ERP docs defaults for ${locales.join(', ')}`;
  const userId = readArg('--user-id') ?? 'system';
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run') || !apply;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Add it to .env or environment.');
  }

  const [{ db, and, eq, cmsSettings, auditLog }, { generateId }] = await Promise.all([
    import('../packages/db/index'),
    import('../packages/shared/src/id/index'),
  ]);

  const defaults = getDefaultEditableDocs();
  const [existing] = await db
    .select({ id: cmsSettings.id, value: cmsSettings.value })
    .from(cmsSettings)
    .where(and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, DOCS_SETTING_KEY)))
    .limit(1);

  const current = normalizeEditableDocs(existing?.value ?? null);
  const next = {
    ...current,
  };

  for (const locale of locales) {
    next[locale] = defaults[locale];
  }

  console.info(`Tenant: ${tenantId}`);
  console.info(`Mode: ${dryRun ? 'dry-run' : 'apply'}`);
  console.info(`Locales: ${locales.join(', ')}`);
  console.info(`Existing setting: ${existing ? existing.id : 'not found'}`);
  for (const locale of locales) {
    console.info(
      `${locale}: ${bodyLength(current[locale])} chars -> ${bodyLength(next[locale])} chars`,
    );
  }

  if (dryRun) {
    console.info(
      '\nNo database changes written. Re-run with --apply to replace selected locale(s).',
    );
    return;
  }

  const settingId = existing?.id ?? generateId();
  const now = new Date();

  if (existing) {
    await db
      .update(cmsSettings)
      .set({ value: next, updatedBy: userId, updatedAt: now })
      .where(eq(cmsSettings.id, existing.id));
  } else {
    await db.insert(cmsSettings).values({
      id: settingId,
      tenantId,
      key: DOCS_SETTING_KEY,
      value: next,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId,
    userId,
    action: existing ? 'update' : 'create',
    entityType: 'cms_settings',
    entityId: settingId,
    before: existing
      ? {
          key: DOCS_SETTING_KEY,
          value: existing.value,
        }
      : null,
    after: {
      key: DOCS_SETTING_KEY,
      value: next,
    },
    metadata: {
      purpose: 'erp_docs_content_refresh',
      locales,
      reason,
    },
    createdAt: now,
  });

  console.info('\nERP docs content refreshed successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
