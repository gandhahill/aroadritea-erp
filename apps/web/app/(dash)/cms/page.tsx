/**
 * CMS Admin — Main Page (SD §31.3)
 * Redirects to the Pages management section.
 */
import { redirect } from 'next/navigation';

export default function CMSIndexPage() {
  redirect('/cms/pages');
}
