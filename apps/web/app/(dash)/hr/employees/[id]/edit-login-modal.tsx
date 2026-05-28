'use client';

import { Button } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState } from 'react';
import type { RoleOption } from '../actions';
import { fetchEmployeeLoginInfo, updateEmployeeLoginAction } from '../actions';

interface EditLoginModalProps {
  employeeId: string;
  roles: RoleOption[];
}

export function EditLoginModal({ employeeId, roles }: EditLoginModalProps) {
  const t = useTranslations('hr.employees');
  const commonT = useTranslations('common.actions');
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(updateEmployeeLoginAction, null);

  const [loginInfo, setLoginInfo] = useState<{
    roleCode: string | null;
    loginScope: string | null;
    requirePasswordChange: boolean | null;
  } | null>(null);

  useEffect(() => {
    if (open) {
      fetchEmployeeLoginInfo(employeeId).then(setLoginInfo);
    }
  }, [open, employeeId]);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
    }
  }, [state?.ok]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center rounded-md border border-brand-cream-3 px-3 text-xs font-semibold text-brand-ink-2 transition-colors hover:bg-brand-cream-2"
      >
        {t('editLogin')}
      </button>

      {open && (
        <dialog
          open
          className="fixed inset-0 z-50 flex h-full w-full max-w-none items-center justify-center border-0 bg-black/40 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-brand-jade/15 bg-brand-paper p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-brand-ink">{t('editLoginTitle')}</h2>
            
            {loginInfo === null ? (
              <div className="flex h-32 items-center justify-center text-sm text-brand-ink-3">Loading...</div>
            ) : (
              <form action={formAction} className="space-y-4 pt-4">
                <input type="hidden" name="employeeId" value={employeeId} />

                {state?.error && (
                  <div className="rounded-md bg-brand-red/10 p-3 text-sm text-brand-red">
                    {state.error}
                  </div>
                )}

                <div>
                  <label htmlFor="roleCode" className="mb-1 block text-sm font-medium text-brand-ink">
                    {t('role')}
                  </label>
                  <select
                    id="roleCode"
                    name="roleCode"
                    defaultValue={loginInfo.roleCode ?? ''}
                    className="w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2 text-sm text-brand-ink outline-none transition-colors focus:border-brand-ember-5"
                  >
                    <option value="">-- {t('selectRole')} --</option>
                    {roles.map((role) => (
                      <option key={role.code} value={role.code}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="loginScope" className="mb-1 block text-sm font-medium text-brand-ink">
                    {t('loginScope')}
                  </label>
                  <select
                    id="loginScope"
                    name="loginScope"
                    defaultValue={loginInfo.loginScope ?? 'same_location'}
                    className="w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2 text-sm text-brand-ink outline-none transition-colors focus:border-brand-ember-5"
                  >
                    <option value="same_location">{t('scopeSameLocation')}</option>
                    <option value="global">{t('scopeGlobal')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="password" className="mb-1 block text-sm font-medium text-brand-ink">
                    {t('newPassword')} ({commonT('optional')})
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Leave blank to keep current"
                    className="w-full rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2 text-sm text-brand-ink outline-none transition-colors focus:border-brand-ember-5 placeholder:text-brand-ink-4"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requirePasswordChange"
                    name="requirePasswordChange"
                    defaultChecked={loginInfo.requirePasswordChange ?? false}
                    className="h-4 w-4 rounded border-brand-cream-3 text-brand-ember-5 focus:ring-brand-ember-5"
                  />
                  <label htmlFor="requirePasswordChange" className="text-sm font-medium text-brand-ink">
                    {t('requirePasswordChange')}
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-brand-cream-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-4 py-2 text-sm font-medium text-brand-ink-2 hover:bg-brand-cream-2"
                  >
                    {commonT('cancel')}
                  </button>
                  <Button type="submit" disabled={isPending} variant="primary" size="sm">
                    {isPending ? commonT('saving') : commonT('save')}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
