'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog, InlineAlert } from '@/components/confirm-dialog';
import { deleteEmployeeAction, hardDeleteEmployeeAction } from '../actions';

interface DeleteEmployeeButtonProps {
  employeeId: string;
}

export function DeleteEmployeeButton({ employeeId }: DeleteEmployeeButtonProps) {
  const t = useTranslations('hr.employees');
  const [openDialogType, setOpenDialogType] = useState<'soft' | 'hard' | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = () => {
    if (!openDialogType) return;
    const isHard = openDialogType === 'hard';
    setError(null);
    startTransition(async () => {
      try {
        const result = isHard 
          ? await hardDeleteEmployeeAction(employeeId)
          : await deleteEmployeeAction(employeeId);
          
        if (result.error) {
          setError(result.error);
          setOpenDialogType(null);
        } else {
          setOpenDialogType(null);
          router.push('/hr/employees');
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setOpenDialogType(null);
      }
    });
  };

  return (
    <div className="flex items-center gap-2 relative">
      <button
        type="button"
        onClick={() => setOpenDialogType('soft')}
        disabled={isPending}
        className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-rose-600 shadow-sm ring-1 ring-inset ring-rose-300 hover:bg-rose-50 disabled:opacity-50"
      >
        {isPending && openDialogType === 'soft' ? '...' : t('deleteAccount')}
      </button>

      <button
        type="button"
        onClick={() => setOpenDialogType('hard')}
        disabled={isPending}
        title={t('hardDeleteHint')}
        className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-50"
      >
        {isPending && openDialogType === 'hard' ? '...' : t('hardDeleteAccount')}
      </button>

      {error && (
        <div className="absolute right-0 top-12 z-10 w-80">
          <InlineAlert message={error} onDismiss={() => setError(null)} tone="error" />
        </div>
      )}

      {openDialogType && (
        <ConfirmDialog
          title={openDialogType === 'hard' ? t('hardDeleteAccount') : t('deleteAccount')}
          message={openDialogType === 'hard' ? t('hardDeleteAccountConfirm') : t('deleteAccountConfirm')}
          onConfirm={handleDelete}
          onCancel={() => setOpenDialogType(null)}
          tone="danger"
        />
      )}
    </div>
  );
}

