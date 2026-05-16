/**
 * Dynamic CMS Page Route — SD §31.4, ADR-0003
 *
 * Renders pages managed via the CMS admin panel.
 * Static routes (tentang, menu, lokasi, etc.) take priority
 * over this dynamic segment — Next.js resolves static first.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedPageBySlug } from '@erp/services/cms';
import type { SiteLocale } from '../../../i18n';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

/** Known static routes — skip CMS lookup for these. */
const STATIC_ROUTES = new Set([
  'tentang',
  'lokasi',
  'menu',
  'syarat-dan-ketentuan',
  'kebijakan-privasi',
  'member',
  'blog',
]);

/** Extract localized text from a JSONB field. */
function localize(
  field: unknown,
  locale: SiteLocale,
): string {
  if (!field || typeof field !== 'object') return '';
  const obj = field as Record<string, string>;
  return obj[locale] || obj.id || obj.en || '';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (STATIC_ROUTES.has(slug)) return {};

  const result = await getPublishedPageBySlug('default', slug);
  if (!result.ok || !result.value) return {};

  const page = result.value;
  const title = localize(page.metaTitle || page.title, locale as SiteLocale);
  const description = localize(page.metaDescription, locale as SiteLocale);

  const meta: Record<string, unknown> = { title };
  if (description) meta.description = description;
  if (page.ogImageUrl) {
    meta.openGraph = { images: [{ url: page.ogImageUrl as string }] };
  }
  return meta;
}

export default async function CmsPage({ params }: Props) {
  const { locale, slug } = await params;

  // Skip if it's a known static route (shouldn't reach here, but safety)
  if (STATIC_ROUTES.has(slug)) notFound();

  const result = await getPublishedPageBySlug('default', slug);
  if (!result.ok || !result.value) notFound();

  const page = result.value;
  const title = localize(page.title, locale as SiteLocale);
  const content = localize(page.content, locale as SiteLocale);

  return (
    <div className="px-4 py-14 sm:px-6">
      <article className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-black text-brand-ink md:text-5xl">
          {title}
        </h1>
        <div
          className="prose prose-brand mt-8 max-w-none text-brand-ink-2"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </article>
    </div>
  );
}
