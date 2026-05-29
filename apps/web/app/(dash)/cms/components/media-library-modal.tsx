'use client';

import { Button } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useState, useRef } from 'react';

export function MediaLibraryModal({
  open,
  onOpenChange,
  onSelectImage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectImage: (url: string, alt: string) => void;
}) {
  const t = useTranslations('cms');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('area', 'cms-images');
      formData.append('visibility', 'public');
      formData.append('imageOnly', 'true');

      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const data = await res.json();
      if (data.url) {
        onSelectImage(data.url, file.name);
        onOpenChange(false);
      }
    } catch (err) {
      console.error(err);
      alert(t('mediaLibrary.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-brand-ink">{t('mediaLibrary.title')}</h2>
          <button onClick={() => onOpenChange(false)} className="text-brand-ink-3 hover:text-brand-ink">&times;</button>
        </div>
        <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-brand-cream-3 rounded-lg bg-brand-cream-1/30">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleUpload}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            variant="primary"
          >
            {uploading ? t('mediaLibrary.uploading') : t('mediaLibrary.uploadImage')}
          </Button>
          <p className="mt-2 text-xs text-brand-ink-3">{t('mediaLibrary.hint')}</p>
        </div>
      </div>
    </div>
  );
}
