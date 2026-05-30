'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog, InlineAlert } from '@/components/confirm-dialog';
import { deleteEmployeeAction } from '../actions';

interface DeleteEmployeeButtonProps {
  employeeId: string;
}

export function DeleteEmployeeButton({ employeeId }: DeleteEmployeeButtonProps) {
  const t = useTranslations('hr.employees');
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteEmployeeAction(employeeId);
        if (result.error) {
          setError(result.error);
          setIsOpen(false);
        } else {
          // Success, close dialog and redirect
          setIsOpen(false);
          router.push('/hr/employees');
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setIsOpen(false);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={isPending}
        className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-rose-600 shadow-sm ring-1 ring-inset ring-rose-300 hover:bg-rose-50 disabled:opacity-50"
      >
        {isPending ? '...' : t('deleteAccount')}
      </button>

      {error && (
        <div className="absolute right-0 top-12 z-10 w-80">
          <InlineAlert message={error} onDismiss={() => setError(null)} tone="error" />
        </div>
      )}

      {isOpen && (
        <ConfirmDialog
          title={t('deleteAccount')}
          message={t('deleteAccountConfirm')}
          onConfirm={handleDelete}
          onCancel={() => setIsOpen(false)}
          tone="danger"
        />
      )}
    </>
  );
}
