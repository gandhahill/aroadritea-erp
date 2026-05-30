import { getSession } from '@/lib/auth';
/**
 * CMS Post — Edit (SD §31.3)
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchCmsPost } from '../../actions';
import { CmsPostForm } from '../../cms-post-form';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Edit Post - ${id.slice(0, 8)}` };
}

export default async function EditCmsPostPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const post = await fetchCmsPost(id);
  if (!post) redirect('/cms/posts');

  return <CmsPostForm post={post} />;
}
