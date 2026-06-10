import { getSession } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchConsumedIngredientsData } from './actions';
import { ConsumedClient } from './client';

export async function generateMetadata() {
  const t = await getTranslations('pos.manualSales');
  return { title: `${t('consumedIngredients')} - POS` };
}

export default async function ConsumedIngredientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  const user = session.user as any;

  const params = await searchParams;
  const page = Number.parseInt(params.page ?? '1', 10);
  const pageSize = Number.parseInt(params.pageSize ?? '10', 10);
  const data = await fetchConsumedIngredientsData(page, pageSize);
  const defaultLocationId = user.locationId || data.locations[0]?.id || '';

  return <ConsumedClient data={data} defaultLocationId={defaultLocationId} />;
}
