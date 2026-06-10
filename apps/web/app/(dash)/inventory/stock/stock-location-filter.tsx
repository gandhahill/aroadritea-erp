'use client';

import { useRouter } from 'next/navigation';

interface Props {
  outlets: Array<{ id: string; label: string }>;
  selectedId: string;
  kind: string;
  allLocationsLabel: string;
  locationFilterLabel: string;
}

export function StockLocationFilter({
  outlets,
  selectedId,
  kind,
  allLocationsLabel,
  locationFilterLabel,
}: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-brand-ink-3">{locationFilterLabel}</span>
      <select
        value={selectedId}
        onChange={(e) => {
          const params = new URLSearchParams();
          if (kind !== 'all') params.set('kind', kind);
          if (e.target.value) params.set('locationId', e.target.value);
          router.push(`/inventory/stock${params.size > 0 ? `?${params.toString()}` : ''}`);
        }}
        className="rounded-lg border border-brand-cream-3 bg-card px-3 py-1.5 text-sm text-brand-ink"
      >
        <option value="">{allLocationsLabel}</option>
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
