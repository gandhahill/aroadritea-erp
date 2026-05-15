import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchCategories } from './actions';
import { CategoriesClient } from './categories-client';

export const metadata: Metadata = {
  title: 'Kategori Produk',
};

export default async function CategoriesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const categories = await fetchCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Kategori Produk</h1>
        <p className="mt-1 text-sm text-brand-ink-3">Kelola kategori untuk produk POS.</p>
      </div>

      <CategoriesClient categories={categories} />
    </div>
  );
}
