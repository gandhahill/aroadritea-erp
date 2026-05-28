import { getSession } from '@/lib/auth';
import { db, eq } from '@erp/db';
import { locations } from '@erp/db';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { OutgoingShipmentForm } from './client';
import { authorizedLocationIdsForTenant } from '@/lib/authz';

export default async function NewOutgoingShipmentPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const t = await getTranslations('logistics.outgoingShipment');

  const scope = await authorizedLocationIdsForTenant(
    String(user.id ?? ''),
    'logistics.shipments.create',
    String(user.tenantId ?? 'default'),
  );

  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');

  let locs = await db.select().from(locations).where(eq(locations.tenantId, String(user.tenantId ?? 'default')));
  if (!scope.global) {
    locs = locs.filter((l) => scope.locationIds.includes(l.id));
  }

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('createNew')}</>} />

      <OutgoingShipmentForm locations={locs} />
    </div>
  );
}
