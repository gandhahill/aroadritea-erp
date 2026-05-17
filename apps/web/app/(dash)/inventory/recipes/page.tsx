/**
 * Recipe (BOM) management — daftar resep produk jadi dengan editor bahan.
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchRecipes } from './actions';
import { RecipesClient } from './recipes-client';

export const metadata: Metadata = { title: 'Resep — Inventaris' };

export default async function RecipesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const data = await fetchRecipes();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Resep (BOM)</h1>
        <p className="mt-1 max-w-3xl text-sm text-brand-ink-3">
          Atur komposisi bahan baku per produk jadi. Sistem memakai resep ini
          untuk auto-deduct stok bahan saat POS menjual produk.
        </p>
      </div>
      <RecipesClient initial={data} />
    </div>
  );
}
