import type { Metadata } from 'next';
import { fetchDocsEditorContent } from './actions';
import { DocsEditorForm } from './docs-editor-form';

export const metadata: Metadata = {
  title: 'CMS Documentation | Aroadri ERP',
};

export default async function CmsDocsPage() {
  const content = await fetchDocsEditorContent();
  return <DocsEditorForm initialContent={content} />;
}
