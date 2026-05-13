'use client';

import { useState, useTransition } from 'react';
import { type PosSettingItem, updatePosSetting } from './actions';

interface Props {
  settings: PosSettingItem[];
}

type Draft = Omit<PosSettingItem, 'id' | 'locationName'>;

const inputClass =
  'h-9 w-full rounded-md border border-brand-cream-3 bg-card px-2.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 disabled:opacity-50';

function toDraft(setting: PosSettingItem): Draft {
  return {
    locationId: setting.locationId,
    pb1TaxCode: setting.pb1TaxCode,
    cashAccountCode: setting.cashAccountCode,
    revenueAccountCode: setting.revenueAccountCode,
    donationTrustAccountCode: setting.donationTrustAccountCode,
    deliveryChannels: setting.deliveryChannels,
    deliveryNetBps: setting.deliveryNetBps,
    receiptWidthMm: setting.receiptWidthMm,
  };
}

export function PosSettingsClient({ settings }: Props) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(settings.map((setting) => [setting.locationId, toDraft(setting)])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateDraft(locationId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [locationId]: { ...(prev[locationId] ?? { locationId }), ...patch } as Draft,
    }));
  }

  function save(locationId: string) {
    const draft = drafts[locationId];
    if (!draft) return;
    setMessage(null);
    setSavingLocation(locationId);
    startTransition(async () => {
      const result = await updatePosSetting(locationId, draft);
      setSavingLocation(null);
      setMessage(result.success ? 'Setting POS tersimpan.' : (result.error ?? 'Gagal menyimpan.'));
    });
  }

  if (settings.length === 0) {
    return (
      <div className="rounded-lg border border-brand-cream-3 px-4 py-8 text-center text-sm text-brand-ink-3">
        Belum ada lokasi. Seed lokasi terlebih dahulu sebelum mengatur POS.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-lg border border-brand-gold/20 bg-brand-gold/5 px-4 py-2 text-sm text-brand-ink">
          {message}
        </div>
      )}

      {settings.map((setting) => {
        const draft = drafts[setting.locationId] ?? toDraft(setting);
        const deliveryPercent = (draft.deliveryNetBps / 100).toFixed(2);
        const isSaving = isPending && savingLocation === setting.locationId;

        return (
          <section key={setting.locationId} className="rounded-lg border border-brand-cream-3 p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-brand-ink">{setting.locationName}</h2>
                <p className="mt-0.5 text-xs text-brand-ink-3">
                  Konfigurasi ini dibaca saat transaksi POS diposting. Tidak perlu deploy ulang.
                </p>
              </div>
              <button
                type="button"
                onClick={() => save(setting.locationId)}
                disabled={isPending}
                className="rounded-md bg-brand-red px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              <label className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">Kode Pajak PB1/PBJT</span>
                <input
                  value={draft.pb1TaxCode}
                  onChange={(event) =>
                    updateDraft(setting.locationId, { pb1TaxCode: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">Akun Kas/Settlement</span>
                <input
                  value={draft.cashAccountCode}
                  onChange={(event) =>
                    updateDraft(setting.locationId, { cashAccountCode: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">Akun Pendapatan</span>
                <input
                  value={draft.revenueAccountCode}
                  onChange={(event) =>
                    updateDraft(setting.locationId, { revenueAccountCode: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">Akun Donasi</span>
                <input
                  value={draft.donationTrustAccountCode}
                  onChange={(event) =>
                    updateDraft(setting.locationId, {
                      donationTrustAccountCode: event.target.value,
                    })
                  }
                  className={inputClass}
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">
                  Channel Delivery Net Settlement
                </span>
                <input
                  value={draft.deliveryChannels.join(', ')}
                  onChange={(event) =>
                    updateDraft(setting.locationId, {
                      deliveryChannels: event.target.value.split(','),
                    })
                  }
                  className={inputClass}
                />
                <span className="block text-[11px] text-brand-ink-3">
                  Pisahkan dengan koma, contoh: gofood, grabfood, shopeefood.
                </span>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">
                  Net Settlement Delivery (bps)
                </span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={draft.deliveryNetBps}
                  onChange={(event) =>
                    updateDraft(setting.locationId, {
                      deliveryNetBps: Number(event.target.value),
                    })
                  }
                  className={inputClass}
                />
                <span className="block text-[11px] text-brand-ink-3">
                  {deliveryPercent}% dari harga, default 80.00%.
                </span>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">Lebar Struk Thermal</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={40}
                    max={120}
                    value={draft.receiptWidthMm}
                    onChange={(event) =>
                      updateDraft(setting.locationId, {
                        receiptWidthMm: Number(event.target.value),
                      })
                    }
                    className={inputClass}
                  />
                  <span className="text-sm text-brand-ink-3">mm</span>
                </div>
                <span className="block text-[11px] text-brand-ink-3">
                  Default 80 mm / 8 cm, bisa disesuaikan printer.
                </span>
              </label>
            </div>
          </section>
        );
      })}
    </div>
  );
}
