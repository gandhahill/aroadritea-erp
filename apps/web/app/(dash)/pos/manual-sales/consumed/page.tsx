import { getSession } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchPosDraftsAction } from '../draft-actions';
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

  // Resolve employee outlet location when session has no locationId
  let userLocationId = String(user.locationId ?? '');
  if (!userLocationId) {
    const tenantId = String(user.tenantId ?? 'default');
    const userId = String(user.id ?? '');
    const { resolveEmployeeForUser } = await import('@erp/services/hr');
    const employee = await resolveEmployeeForUser(tenantId, userId);
    userLocationId = employee?.locationId ?? '';
  }

  const [data, drafts] = await Promise.all([
    fetchConsumedIngredientsData(page, pageSize),
    fetchPosDraftsAction('consumed_ingredients'),
  ]);
  const defaultLocationId = userLocationId || data.locations[0]?.id || '';

  return <ConsumedClient data={data} defaultLocationId={defaultLocationId} drafts={drafts} />;
}
