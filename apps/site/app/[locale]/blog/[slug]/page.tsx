/**
 * Blog post detail — render konten dari CMS.
 */

import { getPublishedPostBySlug } from '@erp/services/cms';
import { sanitizeCmsHtml } from '@erp/shared/sanitize-html';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { SiteLocale } from '../../../../i18n';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

function localize(field: unknown, locale: SiteLocale): string {
  if (!field || typeof field !== 'object') return '';
  const obj = field as Record<string, string>;
  return obj[locale] || obj.id || obj.en || obj.zh || '';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const result = await getPublishedPostBySlug('default', slug);
  if (!result.ok || !result.value) return {};
  const title = localize(result.value.title, locale as SiteLocale);
  const description = localize(result.value.excerpt, locale as SiteLocale);
  const meta: Record<string, unknown> = { title };
  if (description) meta.description = description;
  if (result.value.coverImageUrl) {
    const rawUrl = String(result.value.coverImageUrl);
    const url = rawUrl.startsWith('/api/')
      ? `${process.env.NEXT_PUBLIC_WEB_URL || 'https://erp.aroadritea.com'}${rawUrl}`
      : rawUrl;
    meta.openGraph = { images: [{ url }] };
  }
  return meta;
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  const result = await getPublishedPostBySlug('default', slug);
  if (!result.ok || !result.value) notFound();

  const post = result.value;
  const title = localize(post.title, locale as SiteLocale);
  const content = sanitizeCmsHtml(localize(post.content, locale as SiteLocale));
  let cover = post.coverImageUrl ? String(post.coverImageUrl) : null;
  if (cover?.startsWith('/api/')) {
    cover = `${process.env.NEXT_PUBLIC_WEB_URL || 'https://erp.aroadritea.com'}${cover}`;
  }

  return (
    <div className="px-4 py-14 sm:px-6">
      <article className="mx-auto max-w-3xl">
        {cover ? (
          <img
            src={cover}
            alt={title}
            className="mb-6 w-full rounded-xl border border-brand-cream-3 object-cover"
          />
        ) : null}
        <h1 className="text-3xl font-black text-brand-ink md:text-4xl">{title}</h1>
        <div
          className="prose prose-brand mt-6 max-w-none text-brand-ink-2"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized CMS HTML
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </article>
    </div>
  );
}
