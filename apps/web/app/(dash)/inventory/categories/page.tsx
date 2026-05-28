import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchCategories } from './actions';
import { CategoriesClient } from './categories-client';

export const metadata: Metadata = {
  title: 'Product Categories | Aroadri ERP',
};

export default async function CategoriesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const t = await getTranslations('inventory.categories');

  const categories = await fetchCategories();

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      <CategoriesClient categories={categories} />
    </div>
  );
}
