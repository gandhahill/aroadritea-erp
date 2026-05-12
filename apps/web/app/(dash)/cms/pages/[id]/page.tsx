/**
 * CMS Page — Edit (SD §31.3)
 */
import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { fetchCmsPage } from '../../actions';
import { CmsPageForm } from '../../cms-page-form';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Edit Page — ${id.slice(0, 8)}… — CMS` };
}

export default async function EditCmsPagePage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const page = await fetchCmsPage(id);
  if (!page) redirect('/cms/pages');

  return <CmsPageForm page={page} />;
}