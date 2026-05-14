/**
 * New Stock Opname Session Page - SD §25.9
 *
 * Uses live ERP locations instead of static location IDs.
 */

import { getSession } from '@/lib/auth';
import { getActiveLocationOptions, resolveDefaultLocationId } from '@/lib/location-options';
import { redirect } from 'next/navigation';
import { NewOpnameForm } from './new-opname-form';

export default async function NewOpnamePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const tenantId = (user.tenantId as string) ?? 'default';
  const sessionLocationId = user.locationId as string | undefined;
  const locationOptions = await getActiveLocationOptions({ tenantId, locale: 'id' });
  const defaultLocationId = resolveDefaultLocationId(locationOptions, undefined, sessionLocationId);

  return <NewOpnameForm locationOptions={locationOptions} defaultLocationId={defaultLocationId} />;
}
