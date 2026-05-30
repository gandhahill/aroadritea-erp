'use client';

import { useState, useTransition, useActionState, useEffect } from 'react';
import { Button, Input } from '@erp/ui';
import { createSupplierAction, updateSupplierAction, deleteSupplierAction } from './actions';
import { useTranslations } from 'next-intl';

export function SupplierManagement({ suppliers }: { suppliers: any[] }) {
  const t = useTranslations('purchasing');
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <div className="border-b border-brand-cream-3 px-5 py-4">
          <h2 className="text-base font-semibold text-brand-ink">{t('supplierTitle')}</h2>
        </div>
        <div className="divide-y divide-brand-cream-3">
          {suppliers.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-brand-ink-3">
              {t('noSupplier')}
            </p>
          ) : (
            suppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div>
                  <p className="font-semibold text-brand-ink">{supplier.name}</p>
                  <p className="mt-0.5 text-xs text-brand-ink-3">
                    {[supplier.phone, supplier.email].filter(Boolean).join(' - ') ||
                      t('noContact')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-brand-cream-1 px-2.5 py-1 text-xs font-semibold text-brand-muted">
                    {supplier.isPkp ? 'PKP' : 'Non-PKP'}
                  </span>
                  <button
                    onClick={() => setEditingSupplier(supplier)}
                    className="text-brand-ink-3 hover:text-brand-ink text-sm font-medium"
                  >
                    {t('editSupplier').split(' ')[0] || 'Edit'}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (confirm(t('confirmDelete'))) {
                        startTransition(async () => {
                          await deleteSupplierAction(supplier.id);
                        });
                      }
                    }}
                    className="text-brand-red hover:underline text-sm font-medium"
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-6">
        <SupplierForm 
          key={editingSupplier?.id || 'new'} 
          initialData={editingSupplier} 
          onCancel={() => setEditingSupplier(null)} 
          t={t} 
        />
      </div>
    </div>
  );
}

function SupplierForm({ initialData, onCancel, t }: { initialData: any, onCancel: () => void, t: any }) {
  const isEditing = !!initialData;
  const actionToUse = isEditing ? updateSupplierAction : createSupplierAction;
  const [state, action, pending] = useActionState(actionToUse, { success: false });

  // If successful edit, we want to clear the form and go back to create mode.
  // Actually, revalidation might reset the component, but we can do it via a quick effect
  useEffect(() => {
    if (state.success && isEditing) {
      onCancel();
    }
  }, [state.success, isEditing, onCancel]);

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm"
    >
      <div>
        <h2 className="text-base font-semibold text-brand-ink">
          {isEditing ? t('editSupplier') : t('addSupplier')}
        </h2>
        <p className="mt-1 text-sm text-brand-ink-3">
          {isEditing ? t('editSupplierHelp') : t('addSupplierHelp')}
        </p>
      </div>

      {state.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}
      {state.success && !isEditing ? (
        <div className="rounded-lg border border-brand-jade/30 bg-brand-jade/10 px-3 py-2 text-sm text-brand-jade">
          {t('supplierSaved')}
        </div>
      ) : null}

      {isEditing && <input type="hidden" name="id" value={initialData.id} />}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('supplierName')}</span>
          <Input name="supplierName" required defaultValue={initialData?.name || ''} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Email</span>
          <Input name="supplierEmail" type="email" defaultValue={initialData?.email || ''} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('phone')}</span>
          <Input name="supplierPhone" defaultValue={initialData?.phone || ''} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('paymentTermsDays')}</span>
          <Input name="paymentTermsDays" type="number" min="0" defaultValue={initialData?.paymentTermsDays || '0'} />
        </label>
      </div>

      <label className="space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">{t('address')}</span>
        <textarea 
          name="supplierAddress" 
          rows={3} 
          className="w-full rounded-lg border border-brand-cream-3 px-3 py-2"
          defaultValue={initialData?.address || ''} 
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-brand-ink">
        <input
          name="supplierIsPkp"
          type="checkbox"
          defaultChecked={initialData?.isPkp || false}
          className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
        />
        {t('supplierPkp')}
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} className="rounded-lg flex-1" variant="primary" size="lg">
          {pending ? t('saving') : (isEditing ? t('saveChanges') : t('saveSupplier'))}
        </Button>
        {isEditing && (
          <Button type="button" disabled={pending} onClick={onCancel} className="rounded-lg flex-1" variant="secondary" size="lg">
            {t('cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
