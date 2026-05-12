/**
 * CMS — New Page (SD §31.3)
 */
import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CmsPageForm } from '../../cms-page-form';

export const metadata: Metadata = { title: 'New Page — CMS' };

export default async function NewCmsPagePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <CmsPageForm isNew />;
}