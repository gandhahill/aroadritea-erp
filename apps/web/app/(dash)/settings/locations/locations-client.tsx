'use client';

import { Button, Select, TableBody } from '@erp/ui';
import { useMemo, useState, useTransition } from 'react';
import {
  type LocationActionResult,
  type LocationDraft,
  type LocationItem,
  type LocationStatus,
  type LocationType,
  deleteLocation,
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
  delete: string;
  gpsLat: string;
  gpsLng: string;
  gpsRadius: string;
  pickFromBrowser: string;
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
  gpsLat: '',
  gpsLng: '',
  gpsRadiusM: null,
};

function pickGpsFromBrowser(): Promise<{ lat: string; lng: string } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

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

  function removeRow(row: LocationDraft) {
    if (!row.id) {
      setRows((prev) => prev.filter((item) => item !== row));
      return;
    }
    setPendingId(row.id);
    setResult(null);
    startTransition(async () => {
      const response = await deleteLocation({ id: row.id ?? '' });
      setResult(response);
      setPendingId(null);
      if (response.success) {
        setRows((prev) => prev.filter((item) => item.id !== row.id));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={addRow}
          className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
          variant="primary"
          size="md"
        >
          {labels.add}
        </Button>
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
              <th className="px-3 py-3">{labels.gpsLat}</th>
              <th className="px-3 py-3">{labels.gpsLng}</th>
              <th className="px-3 py-3">{labels.gpsRadius}</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <TableBody className="divide-y divide-brand-cream-3">
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
                  <Select
                    value={row.type}
                    onChange={(event) =>
                      updateRow(index, { type: event.target.value as LocationType })
                    }
                    className="h-9 w-32 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                  >
                    <option value="store">{labels.store}</option>
                    <option value="office">{labels.office}</option>
                    <option value="warehouse">{labels.warehouse}</option>
                  </Select>
                </td>
                <td className="px-3 py-3">
                  <Select
                    value={row.status}
                    onChange={(event) =>
                      updateRow(index, { status: event.target.value as LocationStatus })
                    }
                    className="h-9 w-28 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                  >
                    <option value="active">{labels.active}</option>
                    <option value="inactive">{labels.inactive}</option>
                  </Select>
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
                  <div className="flex flex-col gap-1">
                    <input
                      value={row.gpsLat}
                      onChange={(event) => updateRow(index, { gpsLat: event.target.value })}
                      placeholder="-7.797068"
                      className="h-9 w-28 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const here = await pickGpsFromBrowser();
                        if (here) updateRow(index, { gpsLat: here.lat, gpsLng: here.lng });
                      }}
                      className="text-[10px] text-brand-red hover:underline"
                    >
                      {labels.pickFromBrowser}
                    </button>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <input
                    value={row.gpsLng}
                    onChange={(event) => updateRow(index, { gpsLng: event.target.value })}
                    placeholder="110.370529"
                    className="h-9 w-28 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    step={5}
                    value={row.gpsRadiusM ?? ''}
                    onChange={(event) =>
                      updateRow(index, {
                        gpsRadiusM: event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                    placeholder="100"
                    className="h-9 w-20 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-2 text-brand-ink"
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => submitRow(row)}
                      disabled={isPending && pendingId === (row.id ?? row.code)}
                      className="rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending && pendingId === (row.id ?? row.code)
                        ? labels.saving
                        : labels.save}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(row)}
                      disabled={isPending && pendingId === (row.id ?? row.code)}
                      className="rounded-md border border-brand-cream-3 px-3 py-2 text-xs font-semibold text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {labels.delete}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
