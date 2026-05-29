'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@erp/ui';
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
      alert('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Media Library (T-0257)</DialogTitle>
        </DialogHeader>
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
          >
            {uploading ? 'Uploading...' : 'Upload Image'}
          </Button>
          <p className="mt-2 text-xs text-brand-ink-3">Uploads are saved as public CMS images</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
