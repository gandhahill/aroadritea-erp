'use client';

import { Button, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
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
type PrinterDetectState = 'idle' | 'loading' | 'ready' | 'failed';

const inputClass =
  'h-9 w-full rounded-md border border-brand-cream-3 bg-card px-2.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 disabled:opacity-50';

const PRINT_BRIDGE_CANDIDATES = [
  process.env.NEXT_PUBLIC_PRINT_BRIDGE_URL,
  'https://127.0.0.1:7913',
  'http://127.0.0.1:7913',
  'https://localhost:7913',
  'http://localhost:7913',
].filter((url): url is string => Boolean(url));

function normalizePrinterPayload(payload: unknown): string[] {
  const rawPrinters = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && 'printers' in payload
      ? (payload as { printers?: unknown }).printers
      : [];

  if (!Array.isArray(rawPrinters)) return [];
  return [
    ...new Set(
      rawPrinters
        .map((printer) => {
          if (typeof printer === 'string') return printer.trim();
          if (printer && typeof printer === 'object') {
            const candidate = printer as {
              name?: unknown;
              printerName?: unknown;
              displayName?: unknown;
            };
            return String(
              candidate.name ?? candidate.printerName ?? candidate.displayName ?? '',
            ).trim();
          }
          return '';
        })
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

async function fetchPrintersFromBridge(baseUrl: string): Promise<string[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/printers`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return [];
    return normalizePrinterPayload(await response.json());
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

function toDraft(setting: PosSettingItem): Draft {
  return {
    locationId: setting.locationId,
    pb1TaxCode: setting.pb1TaxCode,
    cashAccountCode: setting.cashAccountCode,
    revenueAccountCode: setting.revenueAccountCode,
    donationTrustAccountCode: setting.donationTrustAccountCode,
    deliveryChannels: setting.deliveryChannels.map((channel) => ({ ...channel })),
    receiptWidthMm: setting.receiptWidthMm,
    receiptPrinterName: setting.receiptPrinterName ?? '',
    labelPrinterName: setting.labelPrinterName ?? '',
    kioskPrintingEnabled: setting.kioskPrintingEnabled,
  };
}

export function PosSettingsClient({ settings, accountOptions }: Props) {
  const t = useTranslations('settings.pos');
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(settings.map((setting) => [setting.locationId, toDraft(setting)])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState<string | null>(null);
  const [printerOptions, setPrinterOptions] = useState<string[]>([]);
  const [printerDetectState, setPrinterDetectState] = useState<PrinterDetectState>('idle');
  const [isPending, startTransition] = useTransition();

  async function detectPrinters() {
    setPrinterDetectState('loading');
    for (const candidate of PRINT_BRIDGE_CANDIDATES) {
      const printers = await fetchPrintersFromBridge(candidate);
      if (printers.length > 0) {
        setPrinterOptions(printers);
        setPrinterDetectState('ready');
        return;
      }
    }
    setPrinterOptions([]);
    setPrinterDetectState('failed');
  }

  useEffect(() => {
    void detectPrinters();
  }, []);

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
      setMessage(result.success ? t('saved') : (result.error ?? t('saveFailed')));
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
        {t('noLocations')}
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
              <Button
                type="button"
                onClick={() => save(setting.locationId)}
                disabled={isPending}
                className="rounded-md bg-brand-red px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
                variant="primary"
                size="sm"
              >
                {isSaving ? t('saving') : t('save')}
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              <label className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">{t('pb1TaxCode')}</span>
                <input
                  value={draft.pb1TaxCode}
                  onChange={(event) =>
                    updateDraft(setting.locationId, { pb1TaxCode: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <div className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">{t('cashAccount')}</span>
                <AccountSelect
                  value={draft.cashAccountCode}
                  options={accountOptions}
                  onChange={(value) => updateDraft(setting.locationId, { cashAccountCode: value })}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">{t('revenueAccount')}</span>
                <AccountSelect
                  value={draft.revenueAccountCode}
                  options={accountOptions}
                  onChange={(value) =>
                    updateDraft(setting.locationId, { revenueAccountCode: value })
                  }
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">{t('donationAccount')}</span>
                <AccountSelect
                  value={draft.donationTrustAccountCode}
                  options={accountOptions}
                  onChange={(value) =>
                    updateDraft(setting.locationId, {
                      donationTrustAccountCode: value,
                    })
                  }
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-brand-ink-2">{t('receiptWidth')}</span>
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
                <span className="block text-[11px] text-brand-ink-3">{t('receiptWidthHint')}</span>
              </label>
              <PrinterNameField
                label={t('receiptPrinter')}
                value={draft.receiptPrinterName ?? ''}
                placeholder={t('receiptPrinterPlaceholder')}
                hint={t('receiptPrinterHint')}
                options={printerOptions}
                onDetect={detectPrinters}
                detectState={printerDetectState}
                onChange={(value) =>
                  updateDraft(setting.locationId, {
                    receiptPrinterName: value,
                  })
                }
              />
              <PrinterNameField
                label={t('labelPrinter')}
                value={draft.labelPrinterName ?? ''}
                placeholder={t('labelPrinterPlaceholder')}
                hint={t('labelPrinterHint')}
                options={printerOptions}
                onDetect={detectPrinters}
                detectState={printerDetectState}
                onChange={(value) =>
                  updateDraft(setting.locationId, {
                    labelPrinterName: value,
                  })
                }
              />
            </div>

            <div className="mt-3 rounded-md border border-brand-cream-3 bg-brand-cream-1 p-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={draft.kioskPrintingEnabled ?? false}
                  onChange={(event) =>
                    updateDraft(setting.locationId, {
                      kioskPrintingEnabled: event.target.checked,
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-brand-cream-3"
                />
                <div>
                  <div className="font-semibold text-brand-ink">{t('kioskPrinting')}</div>
                  <p className="mt-0.5 text-[11px] text-brand-ink-3">
                    {t('kioskPrintingHintBefore')}{' '}
                    <code className="rounded bg-brand-cream-3 px-1 font-mono">
                      --kiosk-printing
                    </code>{' '}
                    {t('kioskPrintingHintAfter')}
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-5 rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-brand-ink">{t('deliveryChannels')}</h3>
                  <p className="mt-0.5 text-xs text-brand-ink-3">{t('deliveryChannelsHint')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => addChannel(setting.locationId)}
                  className="rounded-md border border-brand-cream-3 bg-brand-cream px-3 py-1.5 text-xs font-semibold text-brand-ink hover:border-brand-red/40 hover:text-brand-red"
                >
                  {t('addChannel')}
                </button>
              </div>

              <div className="space-y-3">
                {draft.deliveryChannels.map((channel) => (
                  <div
                    key={channel.id}
                    className="grid gap-3 rounded-md border border-brand-cream-3 bg-card p-3 lg:grid-cols-[1fr_1.4fr_0.9fr_0.9fr_auto_auto]"
                  >
                    <label className="space-y-1">
                      <span className="text-[11px] font-medium text-brand-ink-3">
                        {t('channelCode')}
                      </span>
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
                      <span className="text-[11px] font-medium text-brand-ink-3">
                        {t('channelLabel')}
                      </span>
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
                      <span className="text-[11px] font-medium text-brand-ink-3">
                        {t('netPercent')}
                      </span>
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
                      <span className="text-[11px] font-medium text-brand-ink-3">
                        {t('commissionPercent')}
                      </span>
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
                      {t('active')}
                    </label>
                    <button
                      type="button"
                      onClick={() => removeChannel(setting.locationId, channel.id)}
                      className="self-end rounded-md border border-brand-cream-3 px-3 py-2 text-xs font-semibold text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red"
                    >
                      {t('deleteChannel')}
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
    <Select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
      {!hasCurrent ? <option value={value}>{value}</option> : null}
      {options.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

function PrinterNameField({
  label,
  value,
  placeholder,
  hint,
  options,
  detectState,
  onDetect,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  hint: string;
  options: string[];
  detectState: PrinterDetectState;
  onDetect: () => void;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('settings.pos');
  const hasOptions = options.length > 0;
  const hasCurrent = value && !options.includes(value);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-brand-ink-2">{label}</span>
        <button
          type="button"
          onClick={onDetect}
          disabled={detectState === 'loading'}
          className="rounded-md border border-brand-cream-3 bg-brand-cream px-2 py-1 text-[11px] font-semibold text-brand-ink hover:border-brand-red/40 hover:text-brand-red disabled:opacity-50"
        >
          {detectState === 'loading' ? t('detectingPrinters') : t('detectPrinters')}
        </button>
      </div>
      {hasOptions ? (
        <Select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        >
          <option value="">{placeholder}</option>
          {hasCurrent ? <option value={value}>{value}</option> : null}
          {options.map((printer) => (
            <option key={printer} value={printer}>
              {printer}
            </option>
          ))}
        </Select>
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
      {hasOptions ? (
        <input
          value={value}
          placeholder={t('printerManualOption')}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      ) : null}
      <span className="block text-[11px] text-brand-ink-3">
        {detectState === 'failed' ? t('printerDetectFailed') : hint}
      </span>
      <span className="block text-[11px] text-brand-ink-3">{t('printerBridgeHint')}</span>
    </div>
  );
}
