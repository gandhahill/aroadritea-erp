/**
 * CMS Post Form — Create / Edit (SD §31.3)
 */
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createCmsPost, deleteCmsPost, publishCmsPost, updateCmsPost } from './actions';

interface Props {
  post?: Record<string, unknown> | null;
  isNew?: boolean;
}

const LOCALE_TABS = [
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
];

const KIND_OPTIONS = [
  { value: 'news', label: 'Berita' },
  { value: 'promo', label: 'Promo' },
  { value: 'recipe', label: 'Resep' },
  { value: 'event', label: 'Event' },
];

export function CmsPostForm({ post, isNew = false }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeLocale, setActiveLocale] = useState('id');

  const title = (post?.title as Record<string, string>) ?? {};
  const content = (post?.content as Record<string, string>) ?? {};
  const excerpt = (post?.excerpt as Record<string, string>) ?? {};

  const [titleVals, setTitleVals] = useState<Record<string, string>>(title);
  const [contentVals, setContentVals] = useState<Record<string, string>>(content);
  const [excerptVals, setExcerptVals] = useState<Record<string, string>>(excerpt);

  const kind = (post?.kind as string) ?? 'news';
  const status = (post?.status as string) ?? 'draft';
  const slug = (post?.slug as string) ?? '';
  const tags = ((post?.tags as string[]) ?? []).join(', ');
  const displayOrder = (post?.displayOrder as number) ?? 0;
  const coverImageUrl = (post?.coverImageUrl as string) ?? '';

  const [formData, setFormData] = useState({
    slug,
    kind,
    tags,
    displayOrder: String(displayOrder),
    coverImageUrl,
  });

  function handleSave(publishAfter = false) {
    setError(null);
    const data = {
      slug: formData.slug,
      kind: formData.kind,
      title: titleVals,
      content: contentVals,
      excerpt: excerptVals,
      coverImageUrl: formData.coverImageUrl || undefined,
      tags: formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      displayOrder: Number.parseInt(formData.displayOrder, 10) || 0,
    };

    startTransition(async () => {
      let result;
      if (isNew) {
        result = await createCmsPost(data);
      } else {
        result = await updateCmsPost(post!.id as string, data);
      }

      if (!result.success) {
        setError(result.error ?? 'Gagal menyimpan');
        return;
      }

      if (publishAfter && !isNew) {
        const pub = await publishCmsPost(post!.id as string, 'publish');
        if (!pub.success) {
          setError(pub.error ?? 'Gagal mempublikasikan');
          return;
        }
      }

      router.push('/cms/posts');
      router.refresh();
    });
  }

  async function handleDelete() {
    if (!confirm('Yakin ingin menghapus post ini?')) return;
    startTransition(async () => {
      const result = await deleteCmsPost(post!.id as string);
      if (!result.success) {
        setError(result.error ?? 'Gagal menghapus');
        return;
      }
      router.push('/cms/posts');
      router.refresh();
    });
  }

  async function handlePublish() {
    setError(null);
    startTransition(async () => {
      const result = await publishCmsPost(
        post!.id as string,
        status === 'published' ? 'draft' : 'publish',
      );
      if (!result.success) {
        setError(result.error ?? 'Gagal');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">
            {isNew ? 'Buat Post Baru' : 'Edit Post'}
          </h1>
          {!isNew && (
            <div className="mt-1 flex items-center gap-3">
              <code className="rounded bg-brand-cream-2 px-2 py-0.5 text-xs font-mono text-brand-ink-2">
                /blog/{post?.slug as string}
              </code>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  status === 'published'
                    ? 'bg-brand-jade/10 text-brand-jade'
                    : 'bg-brand-cream-2 text-brand-ink-3'
                }`}
              >
                {status}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isNew && (
            <button
              onClick={handlePublish}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-jade px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-jade/90 disabled:opacity-50"
            >
              {status === 'published' ? 'Unpublish' : 'Publikasi'}
            </button>
          )}
          <button
            onClick={() => handleSave(false)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-red/90 disabled:opacity-50"
          >
            {isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
            <label className="mb-1 block text-sm font-medium text-brand-ink">Judul</label>
            <div className="flex gap-1 border-b border-brand-cream-3">
              {LOCALE_TABS.map((tab) => (
                <button
                  key={tab.code}
                  onClick={() => setActiveLocale(tab.code)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeLocale === tab.code
                      ? 'border-b-2 border-brand-red text-brand-red'
                      : 'text-brand-ink-3 hover:text-brand-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={titleVals[activeLocale] ?? ''}
              onChange={(e) => setTitleVals((v) => ({ ...v, [activeLocale]: e.target.value }))}
              className="mt-3 w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              placeholder={`Judul post (${activeLocale.toUpperCase()})`}
            />
          </div>

          <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
            <label className="mb-1 block text-sm font-medium text-brand-ink">Konten</label>
            <div className="space-y-2">
              {LOCALE_TABS.map((tab) => (
                <div key={tab.code}>
                  <p className="mb-1 text-xs font-medium text-brand-ink-3">{tab.label}</p>
                  <textarea
                    value={contentVals[tab.code] ?? ''}
                    onChange={(e) => setContentVals((v) => ({ ...v, [tab.code]: e.target.value }))}
                    rows={8}
                    className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder={`Konten post (${tab.code.toUpperCase()})`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
            <label className="mb-1 block text-sm font-medium text-brand-ink">
              Cuplikan / Excerpt
            </label>
            <div className="space-y-2">
              {LOCALE_TABS.map((tab) => (
                <div key={tab.code}>
                  <p className="mb-1 text-xs font-medium text-brand-ink-3">{tab.label}</p>
                  <textarea
                    value={excerptVals[tab.code] ?? ''}
                    onChange={(e) => setExcerptVals((v) => ({ ...v, [tab.code]: e.target.value }))}
                    rows={2}
                    className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder={`Cuplikan singkat (${tab.code.toUpperCase()})`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-brand-ink">Pengaturan</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink-3">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData((v) => ({ ...v, slug: e.target.value }))}
                  className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  placeholder="url-slug"
                  disabled={!isNew}
                />
                {isNew && <p className="mt-1 text-xs text-brand-ink-3">Slug tidak dapat diubah.</p>}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink-3">Kategori</label>
                <select
                  value={formData.kind}
                  onChange={(e) => setFormData((v) => ({ ...v, kind: e.target.value }))}
                  className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                >
                  {KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink-3">
                  Tags (pisah koma)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData((v) => ({ ...v, tags: e.target.value }))}
                  className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  placeholder="teh, promo, baru"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink-3">
                  Urutan Tampilan
                </label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData((v) => ({ ...v, displayOrder: e.target.value }))}
                  className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink-3">
                  Gambar Cover URL
                </label>
                <input
                  type="url"
                  value={formData.coverImageUrl}
                  onChange={(e) => setFormData((v) => ({ ...v, coverImageUrl: e.target.value }))}
                  className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {!isNew && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-red-700">Zona Berbahaya</h3>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Hapus Post
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
