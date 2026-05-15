/**
 * Format Config Form — per-location QR format settings.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { type FormatConfigItem, previewQrPayload, updateFormatConfig } from './actions';

interface Props {
  configs: FormatConfigItem[];
}

function labelPreviewLayout(config: FormatConfigItem) {
  const compact = config.labelWidthMm <= 40 || config.labelHeightMm <= 30;
  return compact
    ? {
        qrPx: 42,
        gapPx: 4,
        paddingPx: 3,
        pickupFontPx: 12,
        textFontPx: 8,
        productLines: 2,
      }
    : {
        qrPx: 64,
        gapPx: 6,
        paddingPx: 4,
        pickupFontPx: 16,
        textFontPx: 10,
        productLines: 3,
      };
}

export function FormatConfigForm({ configs }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    configId: string;
    payload: string;
    qrDataUrl: string;
  } | null>(null);

  async function handleUpdate(
    id: string,
    data: {
      format?: string;
      includeOrderId?: boolean;
      parameterOrderJson?: string[];
      labelWidthMm?: number;
      labelHeightMm?: number;
    },
  ) {
    setError(null);
    const result = await updateFormatConfig(id, data);
    if (!result.success) {
      setError(result.error ?? 'Failed to update');
      return;
    }
    startTransition(() => router.refresh());
  }

  async function handlePreview(configId: string, format: string, includeOrderId: boolean) {
    const result = await previewQrPayload('T003', ['C01', 'S02', 'W01'], format, includeOrderId);
    setPreview({ configId, payload: result.payload, qrDataUrl: result.qrDataUrl });
  }

  if (configs.length === 0) {
    return (
      <div className="rounded-lg border border-brand-cream-3 px-4 py-8 text-center text-sm text-brand-ink-3">
        No format configurations found. Run the seed to create defaults.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-brand-red/20 bg-brand-red/5 px-4 py-2 text-sm text-brand-red">
          {error}
        </div>
      )}

      {configs.map((config) => {
        const labelPreview = labelPreviewLayout(config);
        return (
        <div key={config.id} className="rounded-lg border border-brand-cream-3 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-brand-ink">{config.locationName}</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                config.isActive
                  ? 'bg-brand-jade-light text-brand-jade'
                  : 'bg-brand-cream-2 text-brand-ink-3'
              }`}
            >
              {config.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {/* Format */}
            <div>
              <label
                htmlFor={`naixer-format-${config.id}`}
                className="mb-1 block text-xs font-medium text-brand-ink-2"
              >
                QR Format
              </label>
              <select
                id={`naixer-format-${config.id}`}
                value={config.format}
                onChange={(e) => handleUpdate(config.id, { format: e.target.value })}
                disabled={isPending}
                className="w-full rounded border border-brand-cream-3 bg-card px-2.5 py-1.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none disabled:opacity-50"
              >
                <option value="dash">Format B — Dash (default)</option>
                <option value="pipe">Format A — Pipe (vendor)</option>
              </select>
            </div>

            {/* Label Size */}
            <fieldset className="lg:col-span-2">
              <legend className="mb-1 block text-xs font-medium text-brand-ink-2">
                Label Size
              </legend>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdate(config.id, {
                      labelWidthMm: 60,
                      labelHeightMm: 40,
                    })
                  }
                  disabled={isPending}
                  className={`rounded border px-2.5 py-1 text-xs font-medium ${
                    config.labelWidthMm === 60 && config.labelHeightMm === 40
                      ? 'border-brand-red bg-brand-red/10 text-brand-red'
                      : 'border-brand-cream-3 text-brand-ink-2 hover:bg-brand-cream-2'
                  }`}
                >
                  6x4 cm
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdate(config.id, {
                      labelWidthMm: 40,
                      labelHeightMm: 30,
                    })
                  }
                  disabled={isPending}
                  className={`rounded border px-2.5 py-1 text-xs font-medium ${
                    config.labelWidthMm === 40 && config.labelHeightMm === 30
                      ? 'border-brand-red bg-brand-red/10 text-brand-red'
                      : 'border-brand-cream-3 text-brand-ink-2 hover:bg-brand-cream-2'
                  }`}
                >
                  4x3 cm
                </button>
                <div className="flex items-center gap-1">
                  <input
                    aria-label="Label width in millimeters"
                    type="number"
                    min={30}
                    max={100}
                    value={config.labelWidthMm}
                    onChange={(e) =>
                      handleUpdate(config.id, { labelWidthMm: Number(e.target.value) })
                    }
                    disabled={isPending}
                    className="h-7 w-14 rounded border border-brand-cream-3 bg-card px-1.5 text-xs text-brand-ink focus:border-brand-red focus:outline-none"
                  />
                  <span className="text-xs text-brand-ink-3">x</span>
                  <input
                    aria-label="Label height in millimeters"
                    type="number"
                    min={20}
                    max={80}
                    value={config.labelHeightMm}
                    onChange={(e) =>
                      handleUpdate(config.id, { labelHeightMm: Number(e.target.value) })
                    }
                    disabled={isPending}
                    className="h-7 w-14 rounded border border-brand-cream-3 bg-card px-1.5 text-xs text-brand-ink focus:border-brand-red focus:outline-none"
                  />
                  <span className="text-xs text-brand-ink-3">mm</span>
                </div>
              </div>
            </fieldset>

            {/* Include Order ID */}
            <div>
              <p className="mb-1 block text-xs font-medium text-brand-ink-2">Include Order ID</p>
              <div className="flex items-center gap-2 pt-1.5">
                <button
                  type="button"
                  aria-pressed={config.includeOrderId}
                  onClick={() =>
                    handleUpdate(config.id, {
                      includeOrderId: !config.includeOrderId,
                    })
                  }
                  disabled={isPending}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                    config.includeOrderId ? 'bg-brand-red' : 'bg-brand-cream-3'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform duration-200 ease-in-out ${
                      config.includeOrderId ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-sm text-brand-ink-2">
                  {config.includeOrderId ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {/* Parameter Order */}
            <div>
              <p className="mb-1 block text-xs font-medium text-brand-ink-2">Parameter Order</p>
              <div className="flex flex-col gap-1 pt-0.5">
                <input
                  type="text"
                  value={config.parameterOrderJson.join(', ')}
                  onChange={(e) => {
                    const val = e.target.value;
                    const arr = val.split(',').map(s => s.trim()).filter(Boolean);
                    handleUpdate(config.id, { parameterOrderJson: arr });
                  }}
                  disabled={isPending}
                  className="w-full rounded border border-brand-cream-3 bg-card px-2 py-1 text-xs text-brand-ink focus:border-brand-red focus:outline-none disabled:opacity-50"
                  placeholder="e.g. product, modifiers"
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {config.parameterOrderJson.map((param, idx) => (
                    <span
                      key={`${param}-${idx}`}
                      className="inline-flex items-center rounded bg-brand-cream-2 px-1.5 py-0.5 text-[10px] font-mono text-brand-ink-2"
                    >
                      {idx + 1}. {param}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-3 flex items-center gap-3 border-t border-brand-cream-3 pt-3">
            <button
              type="button"
              onClick={() => handlePreview(config.id, config.format, config.includeOrderId)}
              disabled={isPending}
              className="rounded border border-brand-red px-3 py-1 text-xs font-medium text-brand-red hover:bg-brand-red/5 disabled:opacity-50"
            >
              Preview Label
            </button>
            {preview?.configId === config.id && (
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="grid overflow-hidden rounded border border-brand-ink/20 bg-card p-1 shadow-sm"
                  style={{
                    width: `${config.labelWidthMm * 3}px`,
                    minHeight: `${config.labelHeightMm * 3}px`,
                    gridTemplateColumns: `${labelPreview.qrPx}px 1fr`,
                    gap: `${labelPreview.gapPx}px`,
                    padding: `${labelPreview.paddingPx}px`,
                  }}
                >
                  <img
                    src={preview.qrDataUrl}
                    alt="QR preview"
                    style={{ width: `${labelPreview.qrPx}px`, height: `${labelPreview.qrPx}px` }}
                  />
                  <div
                    className="min-w-0 leading-tight text-brand-ink"
                    style={{ fontSize: `${labelPreview.textFontPx}px` }}
                  >
                    <p
                      className="font-bold leading-none"
                      style={{ fontSize: `${labelPreview.pickupFontPx}px` }}
                    >
                      Pickup #3
                    </p>
                    <p className="mt-0.5 font-medium">10:42</p>
                    <p
                      className="mt-0.5 overflow-hidden"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: labelPreview.productLines,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      Glutinous Fragrant Tea (500ml), Less sugar, Normal ice
                    </p>
                  </div>
                </div>
                <code className="rounded bg-brand-cream-2 px-2 py-1 text-xs font-mono text-brand-ink">
                  {preview.payload}
                </code>
              </div>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}
