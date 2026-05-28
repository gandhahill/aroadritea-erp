import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { fetchConsumedIngredientsData } from './actions';
import { ConsumedClient } from './client';

export async function generateMetadata() {
  const t = await getTranslations('pos.manualSales');
  return { title: `${t('consumedIngredients')} - POS` };
}

export default async function ConsumedIngredientsPage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  const user = session.user as any;
  
  const data = await fetchConsumedIngredientsData();
  
  return (
    <ConsumedClient data={data} defaultLocationId={user.locationId || ''} />
  );
}
