/**
 * CMS Page Form — Create / Edit (SD §31.3)
 * Client component for creating or editing a CMS page.
 */
'use client';

import { PageHeader } from '@/components/page-header';
import { Button, Input, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createCmsPage, deleteCmsPage, publishCmsPage, updateCmsPage } from './actions';
import { MarkdownEditor } from './components/markdown-editor';

interface Props {
  page?: Record<string, unknown> | null;
  isNew?: boolean;
}

const LOCALE_TABS = [
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
];

export function CmsPageForm({ page, isNew = false }: Props) {
  const t = useTranslations('cms.pages');
  const tErr = useTranslations('cms.errors');
  const tc = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeLocale, setActiveLocale] = useState('id');

  const title = (page?.title as Record<string, string>) ?? {};
  const content = (page?.content as Record<string, string>) ?? {};
  const metaTitle = (page?.metaTitle as Record<string, string>) ?? {};
  const metaDesc = (page?.metaDescription as Record<string, string>) ?? {};

  const [titleVals, setTitleVals] = useState<Record<string, string>>(title);
  const [contentVals, setContentVals] = useState<Record<string, string>>(content);
  const [metaTitleVals, setMetaTitleVals] = useState<Record<string, string>>(metaTitle);
  const [metaDescVals, setMetaDescVals] = useState<Record<string, string>>(metaDesc);

  const slug = (page?.slug as string) ?? '';
  const type = (page?.type as string) ?? 'page';
  const status = (page?.status as string) ?? 'draft';
  const displayOrder = (page?.displayOrder as number) ?? 0;
  const isInNavbar = (page?.isInNavbar as boolean) ?? false;

  const [formData, setFormData] = useState({
    slug,
    type,
    displayOrder: String(displayOrder),
    isInNavbar,
  });

  function handleSave(publishAfter = false) {
    setError(null);
    const data = {
      slug: formData.slug,
      type: formData.type,
      title: titleVals,
      content: contentVals,
      metaTitle: metaTitleVals,
      metaDescription: metaDescVals,
      displayOrder: Number.parseInt(formData.displayOrder, 10) || 0,
      isInNavbar: formData.isInNavbar,
    };

    startTransition(async () => {
      let result;
      if (isNew) {
        result = await createCmsPage(data);
      } else {
        result = await updateCmsPage(page!.id as string, data);
      }

      if (!result.success) {
        setError(result.error ?? tErr('saveFailed'));
        return;
      }

      if (publishAfter && !isNew) {
        const pub = await publishCmsPage(page!.id as string, 'publish');
        if (!pub.success) {
          setError(pub.error ?? tErr('publishFailed'));
          return;
        }
      }

      router.push('/cms/pages');
      router.refresh();
    });
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleDelete() {
    setShowDeleteConfirm(false);
    startTransition(async () => {
      const result = await deleteCmsPage(page!.id as string);
      if (!result.success) {
        setError(result.error ?? tErr('deleteFailed'));
        return;
      }
      router.push('/cms/pages');
      router.refresh();
    });
  }

  async function handlePublish() {
    setError(null);
    startTransition(async () => {
      const result = await publishCmsPage(
        page!.id as string,
        status === 'published' ? 'draft' : 'publish',
      );
      if (!result.success) {
        setError(result.error ?? tErr('publishFailed'));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={<>{isNew ? t('createNew') : t('editPage')}</>}
        actions={
          <>
            <div className="flex items-center gap-3">
              {!isNew && (
                <button
                  onClick={handlePublish}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-jade px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-jade/90 disabled:opacity-50"
                >
                  {status === 'published' ? t('unpublish') : t('publish')}
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
        {/* Main content */}
        <div className="space-y-4 lg:col-span-2">
          {/* Title */}
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
              placeholder={`${t('pageTitlePlaceholder')} (${activeLocale.toUpperCase()})`}
            />
          </div>

          {/* Content */}
          <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
            <label className="mb-2 block text-sm font-medium text-brand-ink">
              {tc('labels.content')}
            </label>
            <div className="space-y-2">
              {LOCALE_TABS.map((tab) => (
                <div key={tab.code}>
                  <p className="mb-1 text-xs font-medium text-brand-ink-3">{tab.label}</p>
                  <MarkdownEditor
                    value={contentVals[tab.code] ?? ''}
                    onChange={(val) => setContentVals((v) => ({ ...v, [tab.code]: val }))}
                    placeholder={`${t('pageContentPlaceholder')} (${tab.code.toUpperCase()})`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Meta */}
          <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-brand-ink">SEO</h3>
            <div className="space-y-3">
              {LOCALE_TABS.map((tab) => (
                <div key={tab.code}>
                  <p className="mb-1 text-xs font-medium text-brand-ink-3">
                    Meta Title — {tab.label}
                  </p>
                  <Input
                    type="text"
                    value={metaTitleVals[tab.code] ?? ''}
                    onChange={(e) =>
                      setMetaTitleVals((v) => ({ ...v, [tab.code]: e.target.value }))
                    }
                    className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder={`${t('metaTitlePlaceholder')} (${tab.code.toUpperCase()})`}
                  />
                  <p className="mb-1 mt-2 text-xs font-medium text-brand-ink-3">
                    Meta Description — {tab.label}
                  </p>
                  <textarea
                    value={metaDescVals[tab.code] ?? ''}
                    onChange={(e) => setMetaDescVals((v) => ({ ...v, [tab.code]: e.target.value }))}
                    rows={2}
                    className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    placeholder={`${t('metaDescPlaceholder')} (${tab.code.toUpperCase()})`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar settings */}
        <div className="space-y-4">
          <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-brand-ink">{tc('labels.settings')}</h3>
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
                  placeholder={t('slugPlaceholder')}
                  disabled={!isNew}
                />
                {isNew && <p className="mt-1 text-xs text-brand-ink-3">{t('slugHint')}</p>}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink-3">
                  {t('type')}
                </label>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData((v) => ({ ...v, type: e.target.value }))}
                  className="w-full rounded-md border border-brand-cream-3 bg-background px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                >
                  <option value="page">{t('types.page')}</option>
                  <option value="landing">{t('types.landing')}</option>
                  <option value="legal">{t('types.legal')}</option>
                </Select>
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

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isInNavbar}
                  onChange={(e) => setFormData((v) => ({ ...v, isInNavbar: e.target.checked }))}
                  className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
                />
                <span className="text-sm text-brand-ink">{t('showInNavbar')}</span>
              </label>
            </div>
          </div>

          {!isNew && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-red-700">{tc('labels.dangerZone')}</h3>
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
