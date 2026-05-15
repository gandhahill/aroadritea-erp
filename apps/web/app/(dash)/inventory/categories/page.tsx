import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchCategories } from './actions';
import { CategoriesClient } from './categories-client';

export const metadata: Metadata = {
  title: 'Kategori Produk',
};

export default async function CategoriesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const t = await getTranslations('inventory.categories');

  const categories = await fetchCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-brand-ink-3">{t('subtitle')}</p>
      </div>

      <CategoriesClient categories={categories} />
    </div>
  );
}
