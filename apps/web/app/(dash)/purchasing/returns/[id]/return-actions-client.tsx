'use client';

import { InlineAlert } from '@/components/confirm-dialog';
import { Button } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  approvePurchaseReturnAction,
  cancelPurchaseReturnAction,
  postPurchaseReturnAction,
  submitPurchaseReturnAction,
} from '../actions';

interface Props {
  returnId: string;
  status: string;
}

/** Render only the buttons valid for the current status. Server
 *  re-checks permission anyway — this is a UX-only guard. */
export function ReturnActions({ returnId, status }: Props) {
  const t = useTranslations('purchasing.returns');
  const errors = useTranslations('common.errors');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn(returnId);
      if (!res.ok) {
        setError(res.error ?? errors('serverError'));
        return;
      }
      router.refresh();
    });
  }

  if (status === 'posted' || status === 'cancelled') {
    return (
      <div className="rounded-lg border border-brand-cream-3 bg-card p-3 text-xs text-brand-ink-3">
        {t('terminalState')}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-brand-cream-3 bg-card p-3">
      {error ? <InlineAlert message={error} onDismiss={() => setError(null)} /> : null}
      <div className="flex flex-wrap gap-2">
        {status === 'draft' && (
          <Button
            variant="primary"
            size="md"
            disabled={pending}
            onClick={() => handle(submitPurchaseReturnAction)}
          >
            {t('actions.submit')}
          </Button>
        )}
        {status === 'submitted' && (
          <Button
            variant="primary"
            size="md"
            disabled={pending}
            onClick={() => handle(approvePurchaseReturnAction)}
          >
            {t('actions.approve')}
          </Button>
        )}
        {status === 'approved' && (
          <Button
            variant="primary"
            size="md"
            disabled={pending}
            onClick={() =>
              handle(async (id) => {
                const res = await postPurchaseReturnAction(id);
                return { ok: res.ok, error: res.error };
              })
            }
          >
            {t('actions.post')}
          </Button>
        )}
        <Button
          variant="secondary"
          size="md"
          disabled={pending}
          onClick={() => handle(cancelPurchaseReturnAction)}
        >
          {t('actions.cancel')}
        </Button>
      </div>
    </div>
  );
}
