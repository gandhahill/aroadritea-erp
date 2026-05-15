'use client';

import { useState, useTransition } from 'react';
import {
  type AccountOption,
  type DeliveryChannelSetting,
  type PosSettingItem,
  updatePosSetting,
} from './actions';

interface Props {
  settings: PosSettingItem[];
  accountOptions: AccountOption[];
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
    deliveryChannels: setting.deliveryChannels.map((channel) => ({ ...channel })),
    receiptWidthMm: setting.receiptWidthMm,
  };
}

export function PosSettingsClient({ settings, accountOptions }: Props) {
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

  function updateChannel(
    locationId: string,
    channelId: string,
    patch: Partial<DeliveryChannelSetting>,
  ) {
    const draft = drafts[locationId];
    if (!draft) return;
    updateDraft(locationId, {
      deliveryChannels: draft.deliveryChannels.map((channel) => {
        if (channel.id !== channelId) return channel;
        const next = { ...channel, ...patch };
        if (patch.netBps !== undefined && patch.commissionBps === undefined) {
          next.commissionBps = 10000 - patch.netBps;
        }
        if (patch.commissionBps !== undefined && patch.netBps === undefined) {
          next.netBps = 10000 - patch.commissionBps;
        }
        return next;
      }),
    });
  }

  function addChannel(locationId: string) {
    const draft = drafts[locationId];
    if (!draft) return;
    const index = draft.deliveryChannels.length + 1;
    updateDraft(locationId, {
      deliveryChannels: [
        ...draft.deliveryChannels,
        {
          id: `delivery_${index}`,
          label: `Delivery ${index}`,
          netBps: 8000,
          commissionBps: 2000,
          enabled: true,
        },
      ],
    });
  }

  function removeChannel(locationId: string, channelId: string) {
    const draft = drafts[locationId];
    if (!draft) return;
    updateDraft(locationId, {
      deliveryChannels: draft.deliveryChannels.filter((channel) => channel.id !== channelId),
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
        const isSaving = isPending && savingLocation === setting.locationId;

        return (
          <section key={setting.locationId} className="rounded-lg border border-brand-cream-3 p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-brand-ink">{setting.locationName}</h2>
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
                <AccountSelect
                  value={draft.cashAccountCode}
                  options={accountOptions}
                  onChange={(value) => updateDraft(setting.locationId, { cashAccountCode: value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">Akun Pendapatan</span>
                <AccountSelect
                  value={draft.revenueAccountCode}
                  options={accountOptions}
                  onChange={(value) =>
                    updateDraft(setting.locationId, { revenueAccountCode: value })
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">Akun Donasi</span>
                <AccountSelect
                  value={draft.donationTrustAccountCode}
                  options={accountOptions}
                  onChange={(value) =>
                    updateDraft(setting.locationId, {
                      donationTrustAccountCode: value,
                    })
                  }
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
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

            <div className="mt-5 rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-brand-ink">Channel delivery</h3>
                  <p className="mt-0.5 text-xs text-brand-ink-3">
                    Atur nama channel dan komisi masing-masing platform.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addChannel(setting.locationId)}
                  className="rounded-md border border-brand-cream-3 bg-brand-cream px-3 py-1.5 text-xs font-semibold text-brand-ink hover:border-brand-red/40 hover:text-brand-red"
                >
                  Tambah channel
                </button>
              </div>

              <div className="space-y-3">
                {draft.deliveryChannels.map((channel) => (
                  <div
                    key={channel.id}
                    className="grid gap-3 rounded-md border border-brand-cream-3 bg-card p-3 lg:grid-cols-[1fr_1.4fr_0.9fr_0.9fr_auto_auto]"
                  >
                    <label className="space-y-1">
                      <span className="text-[11px] font-medium text-brand-ink-3">Kode</span>
                      <input
                        value={channel.id}
                        onChange={(event) =>
                          updateChannel(setting.locationId, channel.id, {
                            id: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
                          })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] font-medium text-brand-ink-3">Nama tampil</span>
                      <input
                        value={channel.label}
                        onChange={(event) =>
                          updateChannel(setting.locationId, channel.id, {
                            label: event.target.value,
                          })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] font-medium text-brand-ink-3">Net %</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={(channel.netBps / 100).toFixed(2)}
                        onChange={(event) =>
                          updateChannel(setting.locationId, channel.id, {
                            netBps: Math.round(Number(event.target.value) * 100),
                          })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] font-medium text-brand-ink-3">Komisi %</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={(channel.commissionBps / 100).toFixed(2)}
                        onChange={(event) =>
                          updateChannel(setting.locationId, channel.id, {
                            commissionBps: Math.round(Number(event.target.value) * 100),
                          })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="flex items-center gap-2 self-end pb-2 text-xs text-brand-ink-2">
                      <input
                        type="checkbox"
                        checked={channel.enabled}
                        onChange={(event) =>
                          updateChannel(setting.locationId, channel.id, {
                            enabled: event.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-brand-cream-3 text-brand-red"
                      />
                      Aktif
                    </label>
                    <button
                      type="button"
                      onClick={() => removeChannel(setting.locationId, channel.id)}
                      className="self-end rounded-md border border-brand-cream-3 px-3 py-2 text-xs font-semibold text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AccountSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: AccountOption[];
  onChange: (value: string) => void;
}) {
  const hasCurrent = options.some((option) => option.code === value);

  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
      {!hasCurrent ? <option value={value}>{value}</option> : null}
      {options.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
