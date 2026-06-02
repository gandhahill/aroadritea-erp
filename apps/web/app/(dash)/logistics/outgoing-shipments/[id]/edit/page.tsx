import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { and, db, eq } from '@erp/db';
import { locations } from '@erp/db';
import { partners } from '@erp/db/schema/accounting';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { fetchOutgoingShipmentById } from '../../actions';
import { OutgoingShipmentForm } from '../../new/client';

export default async function EditOutgoingShipmentPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const [detail, t] = await Promise.all([
    fetchOutgoingShipmentById(id),
    getTranslations('logistics.outgoingShipment'),
  ]);
  if (!detail) return notFound();

  const scope = await authorizedLocationIdsForTenant(
    String(user.id ?? ''),
    'logistics.shipments.create',
    tenantId,
  );
  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');

  let locs = await db.select().from(locations).where(eq(locations.tenantId, tenantId));
  if (!scope.global) {
    locs = locs.filter((location) => scope.locationIds.includes(location.id));
  }

  const activePartners = await db
    .select({
      id: partners.id,
      name: partners.name,
      address: partners.address,
      phone: partners.phone,
    })
    .from(partners)
    .where(and(eq(partners.tenantId, tenantId), eq(partners.isActive, true)));

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('editTitle')}</>}
        description={<>{detail.number}</>}
        actions={
          <Link
            href={`/logistics/outgoing-shipments/${detail.id}`}
            className="rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-cream-1"
          >
            {t('detail.back')}
          </Link>
        }
      />

      <OutgoingShipmentForm
        mode="edit"
        locations={locs}
        partners={activePartners}
        initialData={detail}
      />
    </div>
  );
}
