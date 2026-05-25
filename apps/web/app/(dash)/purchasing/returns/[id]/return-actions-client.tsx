'use client';

import { Button } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handle(fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn(returnId);
      if (!res.ok) {
        // Plain alert; full toast wiring would pull more deps. Server
        // error messages are already i18n keys.
        alert(res.error ?? 'Error');
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
    <div className="flex flex-wrap gap-2 rounded-lg border border-brand-cream-3 bg-card p-3">
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
  );
}
