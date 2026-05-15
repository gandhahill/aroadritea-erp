'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  type LocationActionResult,
  type LocationDraft,
  type LocationItem,
  type LocationStatus,
  type LocationType,
  saveLocation,
} from './actions';

interface Labels {
  add: string;
  save: string;
  saving: string;
  code: string;
  nameId: string;
  nameEn: string;
  nameZh: string;
  type: string;
  status: string;
  timezone: string;
  currency: string;
  address: string;
  active: string;
  inactive: string;
  store: string;
  office: string;
  warehouse: string;
  saved: string;
}

interface Props {
  locations: LocationItem[];
  labels: Labels;
}

const emptyLocation: LocationDraft = {
  id: null,
  code: '',
  name: { id: '', en: '', zh: '' },
  type: 'store',
  timezone: 'Asia/Jakarta',
  currency: 'IDR',
  address: '',
  status: 'active',
};

export function LocationsClient({ locations, labels }: Props) {
  const [rows, setRows] = useState<LocationDraft[]>(locations);
  const [result, setResult] = useState<LocationActionResult | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedRows = useMemo(
    () => rows.map((row, index) => ({ row, key: row.id ?? `new-${index}` })),
    [rows],
  );

  function updateRow(
    index: number,
    patch: Omit<Partial<LocationDraft>, 'name'> & { name?: Partial<LocationDraft['name']> },
  ) {
    setRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              ...patch,
              name: patch.name ? { ...row.name, ...patch.name } : row.name,
            }
          : row,
      ),
    );
  }

  function addRow() {
    setRows((prev) => [{ ...emptyLocation, name: { ...emptyLocation.name } }, ...prev]);
  }

  function submitRow(row: LocationDraft) {
    const optimisticId = row.id ?? row.code;
    setPendingId(optimisticId || 'new');
    setResult(null);
    startTransition(async () => {
      const response = await saveLocation(row);
      setResult(response);
      setPendingId(null);
      if (response.success && !row.id) {
        setRows((prev) =>
          prev.map((item) =>
            item === row || (!item.id && item.code === row.code)
              ? { ...item, id: response.id }
              : item,
          ),
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={addRow}
          className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
        >
          {labels.add}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            result.success ? 'bg-brand-jade/10 text-brand-jade' : 'bg-brand-red/10 text-brand-red'
          }`}
        >
          {result.success ? labels.saved : result.error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-brand-cream-3 bg-card">
        <table className="min-w-[1120px] w-full text-sm">
          <thead className="bg-brand-cream-2 text-left text-xs uppercase tracking-widest text-brand-ink-3">
            <tr>
              <th className="px-3 py-3">{labels.code}</th>
              <th className="px-3 py-3">{labels.nameId}</th>
              <th className="px-3 py-3">{labels.nameEn}</th>
              <th className="px-3 py-3">{labels.nameZh}</th>
              <th className="px-3 py-3">{labels.type}</th>
              <th className="px-3 py-3">{labels.status}</th>
              <th className="px-3 py-3">{labels.timezone}</th>
              <th className="px-3 py-3">{labels.currency}</th>
              <th className="px-3 py-3">{labels.address}</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3">
            {sortedRows.map(({ row, key }, index) => (
              <tr key={key} className="align-top">
                <td className="px-3 py-3">
                  <input
                    value={row.code}
                    onChange={(event) => updateRow(index, { code: event.target.value })}
                    className="h-9 w-28 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    value={row.name.id}
                    onChange={(event) => updateRow(index, { name: { id: event.target.value } })}
                    className="h-9 w-44 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    value={row.name.en}
                    onChange={(event) => updateRow(index, { name: { en: event.target.value } })}
                    className="h-9 w-44 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    value={row.name.zh}
                    onChange={(event) => updateRow(index, { name: { zh: event.target.value } })}
                    className="h-9 w-40 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                  />
                </td>
                <td className="px-3 py-3">
                  <select
                    value={row.type}
                    onChange={(event) =>
                      updateRow(index, { type: event.target.value as LocationType })
                    }
                    className="h-9 w-32 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                  >
                    <option value="store">{labels.store}</option>
                    <option value="office">{labels.office}</option>
                    <option value="warehouse">{labels.warehouse}</option>
                  </select>
                </td>
                <td className="px-3 py-3">
                  <select
                    value={row.status}
                    onChange={(event) =>
                      updateRow(index, { status: event.target.value as LocationStatus })
                    }
                    className="h-9 w-28 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                  >
                    <option value="active">{labels.active}</option>
                    <option value="inactive">{labels.inactive}</option>
                  </select>
                </td>
                <td className="px-3 py-3">
                  <input
                    value={row.timezone}
                    onChange={(event) => updateRow(index, { timezone: event.target.value })}
                    className="h-9 w-36 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    value={row.currency}
                    onChange={(event) => updateRow(index, { currency: event.target.value })}
                    className="h-9 w-20 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                  />
                </td>
                <td className="px-3 py-3">
                  <textarea
                    value={row.address}
                    onChange={(event) => updateRow(index, { address: event.target.value })}
                    className="min-h-16 w-56 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 py-1.5 text-brand-ink"
                  />
                </td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => submitRow(row)}
                    disabled={isPending && pendingId === (row.id ?? row.code)}
                    className="rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending && pendingId === (row.id ?? row.code) ? labels.saving : labels.save}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
