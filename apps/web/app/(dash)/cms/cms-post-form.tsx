/**
 * CMS Post Form — Create / Edit (SD §31.3)
 */
'use client';

import { FileUploadField } from '@/components/file-upload-field';
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

import { PageHeader } from '@/components/page-header';
import { Button, Input, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';

export function CmsPostForm({ post, isNew = false }: Props) {
  const t = useTranslations('cms.posts');
  const tc = useTranslations('common');
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
        setError(result.error ?? t('errors.saveFailed'));
        return;
      }

      if (publishAfter && !isNew) {
        const pub = await publishCmsPost(post!.id as string, 'publish');
        if (!pub.success) {
          setError(pub.error ?? t('errors.publishFailed'));
          return;
        }
      }

      router.push('/cms/posts');
      router.refresh();
    });
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleDelete() {
    setShowDeleteConfirm(false);
    startTransition(async () => {
      const result = await deleteCmsPost(post!.id as string);
      if (!result.success) {
        setError(result.error ?? t('errors.deleteFailed'));
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
        setError(result.error ?? t('errors.unknown'));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{isNew ? t('createNewPost') : t('editPost')}</>}
        actions={
          <>
            <div className="flex items-center gap-3">
              {!isNew && (
                <button
                  onClick={handlePublish}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-jade px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-jade/90 disabled:opacity-50"
                >
                  {status === 'published' ? tc('actions.unpublish') : tc('actions.publish')}
                </button>
              )}
              <Button
                onClick={() => handleSave(false)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-red/90 disabled:opacity-50"
                variant="primary"
                size="md"
              >
                {isPending ? tc('actions.saving') : tc('actions.save')}
              </Button>
            </div>
          </>
        }
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
            <label className="mb-1 block text-sm font-medium text-brand-ink">
              {tc('labels.title')}
            </label>
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
            <Input
              type="text"
              value={titleVals[activeLocale] ?? ''}
              onChange={(e) => setTitleVals((v) => ({ ...v, [activeLocale]: e.target.value }))}
              className="mt-3 w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              placeholder={`${tc('labels.title')} (${activeLocale.toUpperCase()})`}
            />
          </div>

          <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
            <label className="mb-1 block text-sm font-medium text-brand-ink">
              {tc('labels.content')}
            </label>
            <div className="space-y-2">
              {LOCALE_TABS.map((tab) => (
                <div key={tab.code}>
                  <p className="mb-1 text-xs font-medium text-brand-ink-3">{tab.label}</p>
                  <textarea
                    value={contentVals[tab.code] ?? ''}
                    onChange={(e) => setContentVals((v) => ({ ...v, [tab.code]: e.target.value }))}
                    rows={8}
                    className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder={`${tc('labels.content')} (${tab.code.toUpperCase()})`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
            <label className="mb-1 block text-sm font-medium text-brand-ink">{t('excerpt')}</label>
            <div className="space-y-2">
              {LOCALE_TABS.map((tab) => (
                <div key={tab.code}>
                  <p className="mb-1 text-xs font-medium text-brand-ink-3">{tab.label}</p>
                  <textarea
                    value={excerptVals[tab.code] ?? ''}
                    onChange={(e) => setExcerptVals((v) => ({ ...v, [tab.code]: e.target.value }))}
                    rows={2}
                    className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder={`${t('excerpt')} (${tab.code.toUpperCase()})`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-brand-ink">{t('settings')}</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink-3">
                  {t('slug')}
                </label>
                <Input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData((v) => ({ ...v, slug: e.target.value }))}
                  className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  placeholder="url-slug"
                  disabled={!isNew}
                />
                {isNew && <p className="mt-1 text-xs text-brand-ink-3">{t('slugHint')}</p>}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink-3">
                  {t('category')}
                </label>
                <Select
                  value={formData.kind}
                  onChange={(e) => setFormData((v) => ({ ...v, kind: e.target.value }))}
                  className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                >
                  {KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink-3">
                  {t('tags')}
                </label>
                <Input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData((v) => ({ ...v, tags: e.target.value }))}
                  className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  placeholder={t('tagsPlaceholder')}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink-3">
                  {t('displayOrder')}
                </label>
                <Input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData((v) => ({ ...v, displayOrder: e.target.value }))}
                  className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>

              <FileUploadField
                label={t('coverImage')}
                hiddenName="coverImageUrl"
                value={formData.coverImageUrl}
                area="cms-images"
                visibility="public"
                accept="image/*"
                imageOnly
                onChange={(url) => setFormData((v) => ({ ...v, coverImageUrl: url }))}
              />
            </div>
          </div>

          {!isNew && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-red-700">{t('dangerZone')}</h3>
              {showDeleteConfirm ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-600">{t('confirmDelete')}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={isPending}
                      className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {tc('actions.yesDelete')}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="rounded-md border border-brand-cream-3 px-3 py-2 text-sm font-medium text-brand-ink-3 hover:bg-brand-cream-2"
                    >
                      {tc('actions.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending}
                  className="w-full rounded-md border border-red-300 bg-card px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  {tc('actions.delete')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
