import { getSession } from '@/lib/auth';
import { getSetting } from '@erp/services/cms';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import {
  DOCS_SETTING_KEY,
  type EditableDocsLocaleContent,
  normalizeEditableDocs,
} from './editable-docs';

export const metadata: Metadata = {
  title: 'Docs - Aroadri ERP',
};

type Block =
  | { type: 'h2'; id: string; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] };

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseDocsMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  const seenSlugs = new Map<string, number>();

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: 'p', text: paragraph.join(' ') });
    paragraph = [];
  };

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    blocks.push({ type: listType, items: listItems });
    listType = null;
    listItems = [];
  };

  const uniqueId = (heading: string) => {
    const base = slugify(heading) || 'section';
    const count = seenSlugs.get(base) ?? 0;
    seenSlugs.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      const text = line.replace(/^##\s+/, '').trim();
      blocks.push({ type: 'h2', id: uniqueId(text), text });
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h3', text: line.replace(/^###\s+/, '').trim() });
      continue;
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    if (ordered) {
      flushParagraph();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      if (ordered[1]) listItems.push(ordered[1]);
      continue;
    }

    const unordered = /^[-*]\s+(.+)$/.exec(line);
    if (unordered) {
      flushParagraph();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      if (unordered[1]) listItems.push(unordered[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function renderItemText(text: string) {
  const match = /^(.+):\s+(\/[^\s]+)$/.exec(text);
  if (!match) return text;
  const label = match[1] ?? '';
  const href = match[2] ?? '/docs';
  return (
    <>
      {label}:{' '}
      <Link href={href} className="font-semibold text-brand-red hover:text-brand-red-dark">
        {href}
      </Link>
    </>
  );
}

async function loadDocsContent(locale: 'id' | 'en' | 'zh'): Promise<EditableDocsLocaleContent> {
  const session = await getSession();
  const tenantId =
    ((session?.user as Record<string, unknown> | undefined)?.tenantId as string) ?? 'default';
  const setting = await getSetting(tenantId, DOCS_SETTING_KEY);
  const docs = normalizeEditableDocs(setting.ok ? setting.value?.value : null);
  return docs[locale] ?? docs.id;
}

export default async function DocsPage() {
  const locale = (await getLocale()) as 'id' | 'en' | 'zh';
  const t = await getTranslations('docs');
  const content = await loadDocsContent(locale);
  const blocks = parseDocsMarkdown(content.body);
  const headings = blocks.filter(
    (block): block is Extract<Block, { type: 'h2' }> => block.type === 'h2',
  );

  return (
    <div className="mx-auto flex max-w-[1500px] gap-6">
      <aside className="hidden w-72 shrink-0 lg:block">
        <div className="sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-brand-cream-3 bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-red/80">
            {t('toc')}
          </p>
          <nav className="mt-4 space-y-1">
            {headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                className="block rounded-md px-3 py-2 text-sm text-brand-ink-2 transition-colors hover:bg-brand-cream-1 hover:text-brand-ink"
              >
                {heading.text}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="border-b border-brand-cream-3 pb-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">
                {t('badge')}
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-normal text-brand-ink md:text-4xl">
                {content.title}
              </h1>
              <p className="mt-4 max-w-4xl text-base leading-7 text-brand-ink-3">
                {content.subtitle}
              </p>
            </div>
            <Link
              href="/cms/docs"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-brand-cream-3 bg-brand-cream-1 px-4 text-sm font-semibold text-brand-ink transition-colors hover:border-brand-red/40 hover:text-brand-red"
            >
              {t('edit')}
            </Link>
          </div>
        </header>

        <article className="mt-8 space-y-5">
          {blocks.map((block, index) => {
            if (block.type === 'h2') {
              return (
                <section
                  key={`${block.id}-${index}`}
                  id={block.id}
                  className="scroll-mt-6 rounded-lg border border-brand-cream-3 bg-card p-6 shadow-sm"
                >
                  <h2 className="text-2xl font-semibold text-brand-ink">{block.text}</h2>
                </section>
              );
            }

            if (block.type === 'h3') {
              return (
                <h3
                  key={`${block.text}-${index}`}
                  className="pt-3 text-lg font-semibold text-brand-ink"
                >
                  {block.text}
                </h3>
              );
            }

            if (block.type === 'p') {
              return (
                <p
                  key={`${block.text}-${index}`}
                  className="max-w-4xl text-sm leading-7 text-brand-ink-2"
                >
                  {block.text}
                </p>
              );
            }

            if (block.type === 'ol') {
              return (
                <ol key={`ol-${index}`} className="max-w-4xl space-y-3">
                  {block.items.map((item, itemIndex) => (
                    <li
                      key={`${item}-${itemIndex}`}
                      className="flex gap-3 text-sm leading-7 text-brand-ink-2"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-red text-xs font-bold text-white">
                        {itemIndex + 1}
                      </span>
                      <span className="pt-0.5">{renderItemText(item)}</span>
                    </li>
                  ))}
                </ol>
              );
            }

            return (
              <ul key={`ul-${index}`} className="max-w-4xl space-y-2">
                {block.items.map((item, itemIndex) => (
                  <li
                    key={`${item}-${itemIndex}`}
                    className="flex gap-3 text-sm leading-7 text-brand-ink-2"
                  >
                    <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-brand-gold" />
                    <span>{renderItemText(item)}</span>
                  </li>
                ))}
              </ul>
            );
          })}
        </article>
      </main>
    </div>
  );
}
