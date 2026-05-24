/**
 * Recipe (BOM) management — daftar resep produk jadi dengan editor bahan.
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchRecipes } from './actions';
import { RecipesClient } from './recipes-client';

import { getTranslations } from 'next-intl/server';
import { PageHeader } from "@/components/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('inventory.recipes');
  return { title: t('title') };
}

export default async function RecipesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const data = await fetchRecipes();
  const t = await getTranslations('inventory.recipes');
  return (
    <div className="space-y-6">
      <PageHeader 
            title={<>{t('title')}</>}
            description={<>{t('subtitle')}</>}
          />
      <RecipesClient initial={data} />
    </div>
  );
}
