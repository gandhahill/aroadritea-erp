import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { and, db, eq } from '@erp/db';
import { locations } from '@erp/db';
import { partners } from '@erp/db/schema/accounting';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { OutgoingShipmentForm } from './client';

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

  let locs = await db
    .select()
    .from(locations)
    .where(eq(locations.tenantId, String(user.tenantId ?? 'default')));
  if (!scope.global) {
    locs = locs.filter((l) => scope.locationIds.includes(l.id));
  }

  const activePartners = await db
    .select({
      id: partners.id,
      name: partners.name,
      address: partners.address,
      phone: partners.phone,
    })
    .from(partners)
    .where(
      and(eq(partners.tenantId, String(user.tenantId ?? 'default')), eq(partners.isActive, true)),
    );

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('createNew')}</>} />

      <OutgoingShipmentForm locations={locs} partners={activePartners} />
    </div>
  );
}
