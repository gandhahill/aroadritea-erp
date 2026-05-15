'use client';

import { displayAssetUrl } from '@/lib/display-asset-url';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface Props {
  label: string;
  hiddenName: string;
  value?: string | null;
  area: string;
  visibility?: 'public' | 'private';
  accept?: string;
  imageOnly?: boolean;
  onChange?: (url: string, fileName: string) => void;
}

export function FileUploadField({
  label,
  hiddenName,
  value,
  area,
  visibility = 'private',
  accept,
  imageOnly = false,
  onChange,
}: Props) {
  const t = useTranslations('files');
  const [url, setUrl] = useState(value ?? '');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('area', area);
      body.set('visibility', visibility);
      body.set('imageOnly', String(imageOnly));
      const response = await fetch('/api/uploads', { method: 'POST', body });
      const payload = (await response.json()) as {
        url?: string;
        fileName?: string;
        error?: string;
      };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? 'upload-failed');
      setUrl(payload.url);
      setFileName(payload.fileName ?? file.name);
      onChange?.(payload.url, payload.fileName ?? file.name);
    } catch {
      setError(t('uploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={hiddenName} value={url} />
      <p className="text-sm font-medium text-brand-ink">{label}</p>
      <div className="rounded-lg border border-brand-cream-3 bg-brand-cream p-3">
        {url ? (
          <div className="mb-3 flex items-center gap-3">
            {imageOnly ? (
              <img
                src={displayAssetUrl(url)}
                alt={fileName || t('preview')}
                className="h-20 w-20 rounded-md object-cover"
              />
            ) : (
              <a
                href={displayAssetUrl(url)}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-brand-red"
              >
                {fileName || t('current')}
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                setUrl('');
                setFileName('');
                onChange?.('', '');
              }}
              className="rounded-md border border-brand-cream-3 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-cream-2"
            >
              {t('remove')}
            </button>
          </div>
        ) : null}
        <label className="inline-flex cursor-pointer items-center rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark">
          {uploading ? t('uploading') : url ? t('replace') : t('choose')}
          <input
            type="file"
            accept={accept}
            disabled={uploading}
            onChange={(event) => upload(event.target.files?.[0])}
            className="sr-only"
          />
        </label>
        <p className="mt-2 text-xs text-brand-ink-3">{t('maxSize')}</p>
        {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}
      </div>
    </div>
  );
}
