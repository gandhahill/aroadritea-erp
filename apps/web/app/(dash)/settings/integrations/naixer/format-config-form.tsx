/**
 * Format Config Form — per-location QR format settings.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateFormatConfig,
  previewQrPayload,
  type FormatConfigItem,
} from './actions';

interface Props {
  configs: FormatConfigItem[];
}

export function FormatConfigForm({ configs }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleUpdate(
    id: string,
    data: {
      format?: string;
      includeOrderId?: boolean;
      parameterOrderJson?: string[];
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

  async function handlePreview(format: string, includeOrderId: boolean) {
    const result = await previewQrPayload(
      'T003',
      ['C01', 'S02', 'W01'],
      format,
      includeOrderId,
    );
    setPreview(result.payload);
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

      {configs.map((config) => (
        <div
          key={config.id}
          className="rounded-lg border border-brand-cream-3 p-4"
        >
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

          <div className="grid grid-cols-3 gap-4">
            {/* Format */}
            <div>
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">
                QR Format
              </label>
              <select
                value={config.format}
                onChange={(e) =>
                  handleUpdate(config.id, { format: e.target.value })
                }
                disabled={isPending}
                className="w-full rounded border border-brand-cream-3 bg-white px-2.5 py-1.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none disabled:opacity-50"
              >
                <option value="dash">
                  Format B — Dash (default)
                </option>
                <option value="pipe">
                  Format A — Pipe (vendor)
                </option>
              </select>
            </div>

            {/* Include Order ID */}
            <div>
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">
                Include Order ID
              </label>
              <div className="flex items-center gap-2 pt-1.5">
                <button
                  type="button"
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
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
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
              <label className="mb-1 block text-xs font-medium text-brand-ink-2">
                Parameter Order
              </label>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {config.parameterOrderJson.map((param, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded bg-brand-cream-2 px-1.5 py-0.5 text-[11px] font-mono text-brand-ink-2"
                  >
                    {idx + 1}. {param}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-3 flex items-center gap-3 border-t border-brand-cream-3 pt-3">
            <button
              type="button"
              onClick={() =>
                handlePreview(config.format, config.includeOrderId)
              }
              disabled={isPending}
              className="rounded border border-brand-red px-3 py-1 text-xs font-medium text-brand-red hover:bg-brand-red/5 disabled:opacity-50"
            >
              Preview QR Payload
            </button>
            {preview && (
              <code className="rounded bg-brand-cream-2 px-2 py-1 text-xs font-mono text-brand-ink">
                {preview}
              </code>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
