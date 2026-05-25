'use client';

import { Button, Input, Select } from '@erp/ui';
import { useState } from 'react';
import { createSopAction } from './actions';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORIES = ['general', 'operations', 'hr', 'finance', 'safety', 'service'] as const;

export function SopUploadForm({ onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('general');
  const [publish, setPublish] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('Pilih file SOP terlebih dahulu (PDF / DOC / gambar).');
      return;
    }
    if (!title.trim()) {
      setError('Judul wajib diisi.');
      return;
    }

    setBusy(true);
    try {
      // 1) Upload the file through the generic upload endpoint so we
      //    benefit from the existing magic-byte / mime / size checks.
      const formData = new FormData();
      formData.set('file', file);
      formData.set('area', 'sop');
      formData.set('visibility', 'private');

      const uploadRes = await fetch('/api/uploads', { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        const payload = await uploadRes.json().catch(() => ({ error: 'upload-failed' }));
        setError(payload.error ?? 'upload-failed');
        return;
      }
      const stored = (await uploadRes.json()) as {
        key: string;
        url: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
      };

      // 2) Persist the SOP metadata row.
      const result = await createSopAction({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        fileKey: stored.key,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
        publish,
      });
      if (!result.ok) {
        setError(result.error ?? 'sop.createFailed');
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 rounded-xl border border-brand-cream-3 bg-card p-6 shadow-2xl"
      >
        <header className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-brand-ink">Upload dokumen SOP</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-ink-3 hover:text-brand-ink"
            aria-label="close"
          >
            ×
          </button>
        </header>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-brand-ink">Judul *</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-brand-ink">Kategori</span>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-brand-ink">Deskripsi (opsional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-brand-ink">Berkas SOP *</span>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-brand-ink"
            required
          />
          <p className="text-xs text-brand-ink-3">
            Maks 10 MB. PDF disarankan untuk dokumen final.
          </p>
        </label>

        <label className="flex items-center gap-2 text-sm text-brand-ink">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
          />
          Langsung publikasikan ke karyawan
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={busy}>
            {busy ? 'Mengunggah…' : 'Simpan SOP'}
          </Button>
        </div>
      </form>
    </div>
  );
}
