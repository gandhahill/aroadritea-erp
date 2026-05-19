'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmDialog, InlineAlert } from '@/components/confirm-dialog';
import { deactivateProductAction, reactivateProductAction } from './actions';

interface Props {
  productId: string;
  isActive: boolean;
}

export function ProductRowActions({ productId, isActive }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function runDeactivate() {
    const fd = new FormData();
    fd.set('productId', productId);
    startTransition(async () => {
      const res = await deactivateProductAction(fd);
      if (!res.ok) {
        setErrorMessage(res.error ?? 'Gagal menonaktifkan produk.');
        return;
      }
      router.refresh();
    });
  }

  function handleDeactivate() {
    setConfirmAction({
      message:
        'Nonaktifkan produk ini? Produk yang sudah pernah dijual tidak bisa dihapus permanen — gunakan nonaktif agar histori tetap utuh.',
      onConfirm: runDeactivate,
    });
  }

  function handleReactivate() {
    const fd = new FormData();
    fd.set('productId', productId);
    startTransition(async () => {
      const res = await reactivateProductAction(fd);
      if (!res.ok) {
        setErrorMessage(res.error ?? 'Gagal mengaktifkan produk.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={isActive ? handleDeactivate : handleReactivate}
        disabled={pending}
        className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
          isActive
            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
            : 'border-brand-jade/30 bg-brand-jade-light text-brand-jade hover:bg-brand-jade/15'
        }`}
      >
        {pending ? '…' : isActive ? 'Nonaktifkan' : 'Aktifkan'}
      </button>
      {errorMessage && (
        <InlineAlert
          message={errorMessage}
          tone="error"
          onDismiss={() => setErrorMessage(null)}
        />
      )}
      {confirmAction && (
        <ConfirmDialog
          message={confirmAction.message}
          confirmLabel="Nonaktifkan"
          cancelLabel="Batal"
          tone="danger"
          onConfirm={() => {
            confirmAction.onConfirm();
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
