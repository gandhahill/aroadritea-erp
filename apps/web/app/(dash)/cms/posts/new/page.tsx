import { getSession } from '@/lib/auth';
/**
 * CMS — New Post (SD §31.3)
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CmsPostForm } from '../../cms-post-form';

export const metadata: Metadata = { title: 'New Post — CMS' };

export default async function NewCmsPostPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <CmsPostForm isNew />;
}
