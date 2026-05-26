import { type AppLocale, DOCS_CONTENT, type DocsContent } from './docs-content';
import { DOCS_SUPPLEMENT } from './docs-supplement';

export const DOCS_SETTING_KEY = 'erp_docs_content';

export type EditableDocsLocaleContent = {
  title: string;
  subtitle: string;
  body: string;
};

export type EditableDocsContent = Record<AppLocale, EditableDocsLocaleContent>;

function sectionToMarkdown(locale: AppLocale, content: DocsContent): string {
  const lines: string[] = [];

  lines.push(`## ${content.quickTitle}`);
  for (const path of content.quickPaths) {
    lines.push(`### ${path.title}`);
    lines.push(path.description);
    if (path.links.length > 0) {
      lines.push(...path.links.map((link) => `- ${link.label}: ${link.href}`));
    }
  }

  for (const section of content.sections) {
    lines.push(`## ${section.title}`);
    lines.push(section.summary);
    lines.push('### Step by step');
    lines.push(...section.steps.map((step) => `1. ${step}`));
    lines.push('### Control checks');
    lines.push(...section.checks.map((check) => `- ${check}`));
    if (section.links?.length) {
      lines.push('### Related pages');
      lines.push(...section.links.map((link) => `- ${link.label}: ${link.href}`));
    }
  }

  const supplement = DOCS_SUPPLEMENT[locale]?.trim();
  if (supplement) {
    lines.push(supplement);
  }

  lines.push(`## ${content.assessorTitle}`);
  lines.push(content.assessorIntro);
  for (const item of content.assessorItems) {
    lines.push(`### ${item.standard}`);
    lines.push(item.focus);
    lines.push(item.evidence);
  }

  lines.push(`## ${content.supportTitle}`);
  lines.push(...content.supportSteps.map((step) => `1. ${step}`));

  return lines.join('\n\n');
}

export function getDefaultEditableDocs(): EditableDocsContent {
  return {
    id: {
      title: DOCS_CONTENT.id.title,
      subtitle: DOCS_CONTENT.id.subtitle,
      body: sectionToMarkdown('id', DOCS_CONTENT.id),
    },
    en: {
      title: DOCS_CONTENT.en.title,
      subtitle: DOCS_CONTENT.en.subtitle,
      body: sectionToMarkdown('en', DOCS_CONTENT.en),
    },
    zh: {
      title: DOCS_CONTENT.zh.title,
      subtitle: DOCS_CONTENT.zh.subtitle,
      body: sectionToMarkdown('zh', DOCS_CONTENT.zh),
    },
  };
}

function readLocaleContent(value: unknown, fallback: EditableDocsLocaleContent) {
  if (!value || typeof value !== 'object') return fallback;
  const record = value as Record<string, unknown>;
  return {
    title: typeof record.title === 'string' && record.title.trim() ? record.title : fallback.title,
    subtitle:
      typeof record.subtitle === 'string' && record.subtitle.trim()
        ? record.subtitle
        : fallback.subtitle,
    body: typeof record.body === 'string' && record.body.trim() ? record.body : fallback.body,
  };
}

export function normalizeEditableDocs(value: unknown): EditableDocsContent {
  const defaults = getDefaultEditableDocs();
  if (!value || typeof value !== 'object') return defaults;
  const record = value as Record<string, unknown>;

  return {
    id: readLocaleContent(record.id, defaults.id),
    en: readLocaleContent(record.en, defaults.en),
    zh: readLocaleContent(record.zh, defaults.zh),
  };
}
