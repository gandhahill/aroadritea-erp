'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function ShiftLocationSelector({
  locations,
  currentLocationId,
}: {
  locations: { id: string; name: string }[];
  currentLocationId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <select
      name="locationId"
      value={currentLocationId}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('locationId', e.target.value);
        router.push(`${pathname}?${params.toString()}`);
      }}
      className="rounded-md border border-brand-cream-3 bg-card px-3 py-1.5 text-sm outline-none focus:border-brand-red"
    >
      {locations.map((loc) => (
        <option key={loc.id} value={loc.id}>
          {loc.name}
        </option>
      ))}
    </select>
  );
}
