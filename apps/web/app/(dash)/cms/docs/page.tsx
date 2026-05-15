import type { Metadata } from 'next';
import { fetchDocsEditorContent } from './actions';
import { DocsEditorForm } from './docs-editor-form';

export const metadata: Metadata = {
  title: 'Edit Docs - CMS',
};

export default async function CmsDocsPage() {
  const content = await fetchDocsEditorContent();
  return <DocsEditorForm initialContent={content} />;
}
