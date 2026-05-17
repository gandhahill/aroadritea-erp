/**
 * Blog index — daftar post yang sudah dipublikasi via CMS.
 */

import { listPublishedPosts } from '@erp/services/cms';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { SiteLocale } from '../../../i18n';

export const metadata: Metadata = { title: 'Blog' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
}

const KIND_LABEL: Record<string, string> = {
  news: 'Berita',
  promo: 'Promo',
  recipe: 'Resep',
  event: 'Event',
};

function localize(field: unknown, locale: SiteLocale): string {
  if (!field || typeof field !== 'object') return '';
  const obj = field as Record<string, string>;
  return obj[locale] || obj.id || obj.en || obj.zh || '';
}

export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await params;
  const result = await listPublishedPosts('default', { limit: 100 });
  const posts = result.ok ? result.value : [];

  return (
    <div className="px-4 py-14 sm:px-6">
      <article className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-black text-brand-ink md:text-5xl">Blog</h1>
        <p className="mt-3 max-w-2xl text-base text-brand-ink-2">
          Berita, promo, resep, dan event Aroadri Tea.
        </p>

        {posts.length === 0 ? (
          <p className="mt-10 rounded-lg border border-brand-cream-3 bg-card p-6 text-sm text-brand-ink-3">
            Belum ada post. Cek lagi nanti, ya.
          </p>
        ) : (
          <ul className="mt-10 grid gap-4 md:grid-cols-2">
            {posts.map((p) => {
              const title = localize(p.title, locale as SiteLocale);
              const excerpt = localize(p.excerpt, locale as SiteLocale);
              const slug = String(p.slug ?? '');
              const kind = String(p.kind ?? 'news');
              return (
                <li
                  key={String(p.id)}
                  className="rounded-xl border border-brand-cream-3 bg-card p-5 transition-colors hover:border-brand-red/40"
                >
                  <span className="text-xs font-semibold uppercase tracking-widest text-brand-red">
                    {KIND_LABEL[kind] ?? kind}
                  </span>
                  <h2 className="mt-2 text-lg font-bold text-brand-ink">
                    <Link href={`/${locale}/blog/${slug}`} className="hover:underline">
                      {title || slug}
                    </Link>
                  </h2>
                  {excerpt ? (
                    <p className="mt-2 text-sm text-brand-ink-2 line-clamp-3">{excerpt}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </div>
  );
}
