'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  type PermissionMatrix,
  createRoleAction,
  deleteRoleAction,
  setRolePermission,
  updateRoleAction,
} from './actions';

export function PermissionsMatrix({ matrix }: { matrix: PermissionMatrix }) {
  const t = useTranslations('settings.permissions');
  const tc = useTranslations('common');
  const router = useRouter();
  const [grants, setGrants] = useState(matrix.grants);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [newRole, setNewRole] = useState({ code: '', id: '', en: '', zh: '' });
  const [roleDrafts, setRoleDrafts] = useState(() =>
    Object.fromEntries(
      matrix.roles.map((role) => [
        role.id,
        {
          id: role.name.id ?? role.code,
          en: role.name.en ?? role.name.id ?? role.code,
          zh: role.name.zh ?? role.name.id ?? role.code,
        },
      ]),
    ),
  );

  const wildcardPermId = useMemo(
    () => matrix.permissions.find((p) => p.code === '*.*')?.id,
    [matrix.permissions],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof matrix.permissions>();
    for (const permission of matrix.permissions) {
      const list = map.get(permission.module) ?? [];
      list.push(permission);
      map.set(permission.module, list);
    }
    return [...map.entries()];
  }, [matrix.permissions]);

  function isGranted(roleId: string, permissionId: string) {
    return new Set(grants[roleId] ?? []).has(permissionId);
  }

  function toggle(roleId: string, permissionId: string, granted: boolean) {
    const before = grants;
    setMessage(null);
    setGrants((current) => {
      const next = { ...current };
      const set = new Set(next[roleId] ?? []);
      if (granted) set.add(permissionId);
      else set.delete(permissionId);
      next[roleId] = [...set];
      return next;
    });

    startTransition(async () => {
      const result = await setRolePermission({ roleId, permissionId, granted });
      if (!result.ok) {
        setGrants(before);
        setMessage(result.error ?? t('errors.savePermission'));
      }
    });
  }

  function saveNewRole() {
    setMessage(null);
    startTransition(async () => {
      const result = await createRoleAction({
        code: newRole.code,
        name: { id: newRole.id, en: newRole.en, zh: newRole.zh },
      });
      if (!result.ok) {
        setMessage(result.error ?? t('errors.createRole'));
        return;
      }
      setNewRole({ code: '', id: '', en: '', zh: '' });
      router.refresh();
    });
  }

  function saveRole(roleId: string) {
    const draft = roleDrafts[roleId];
    if (!draft) return;
    setMessage(null);
    startTransition(async () => {
      const result = await updateRoleAction({ id: roleId, name: draft });
      if (!result.ok) setMessage(result.error ?? t('errors.saveRole'));
      else router.refresh();
    });
  }

  function deleteRole(roleId: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await deleteRoleAction(roleId);
      if (!result.ok) setMessage(result.error ?? t('errors.deleteRole'));
      else router.refresh();
    });
  }

  if (!matrix.canManage) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        {t('noAccess')}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {message ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message}
        </div>
      ) : null}
      {pending ? (
        <p className="text-xs font-medium text-brand-ink-3">{tc('actions.saving')}</p>
      ) : null}

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-brand-ink">Role</h2>
          <p className="mt-1 text-sm text-brand-ink-3">{t('subtitle')}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1.3fr_1.3fr_1.3fr_auto]">
          <Input
            label={tc('fields.code')}
            value={newRole.code}
            onChange={(value) => setNewRole((current) => ({ ...current, code: value }))}
            placeholder="store_supervisor"
          />
          <Input
            label={tc('fields.nameId')}
            value={newRole.id}
            onChange={(value) => setNewRole((current) => ({ ...current, id: value }))}
            placeholder="Supervisor Outlet"
          />
          <Input
            label={tc('fields.nameEn')}
            value={newRole.en}
            onChange={(value) => setNewRole((current) => ({ ...current, en: value }))}
            placeholder="Store Supervisor"
          />
          <Input
            label={tc('fields.nameZh')}
            value={newRole.zh}
            onChange={(value) => setNewRole((current) => ({ ...current, zh: value }))}
            placeholder="门店主管"
          />
          <button
            type="button"
            onClick={saveNewRole}
            disabled={pending}
            className="self-end rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
          >
            {t('addRole')}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {matrix.roles.map((role) => {
            const draft = roleDrafts[role.id] ?? {
              id: role.name.id ?? role.code,
              en: role.name.en ?? role.code,
              zh: role.name.zh ?? role.code,
            };
            return (
              <div
                key={role.id}
                className="grid gap-2 rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-3 md:grid-cols-[0.8fr_1.2fr_1.2fr_1.2fr_auto_auto]"
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-ink-3">
                    {tc('fields.code')}
                  </p>
                  <p className="mt-2 font-mono text-xs font-semibold text-brand-ink">{role.code}</p>
                </div>
                <Input
                  label={tc('fields.nameId')}
                  value={draft.id}
                  onChange={(value) =>
                    setRoleDrafts((current) => ({
                      ...current,
                      [role.id]: { ...draft, id: value },
                    }))
                  }
                />
                <Input
                  label={tc('fields.nameEn')}
                  value={draft.en}
                  onChange={(value) =>
                    setRoleDrafts((current) => ({
                      ...current,
                      [role.id]: { ...draft, en: value },
                    }))
                  }
                />
                <Input
                  label={tc('fields.nameZh')}
                  value={draft.zh}
                  onChange={(value) =>
                    setRoleDrafts((current) => ({
                      ...current,
                      [role.id]: { ...draft, zh: value },
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() => saveRole(role.id)}
                  disabled={pending}
                  className="self-end rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
                >
                  {tc('actions.save')}
                </button>
                <button
                  type="button"
                  onClick={() => deleteRole(role.id)}
                  disabled={pending || (!!wildcardPermId && isGranted(role.id, wildcardPermId))}
                  className="self-end rounded-md border border-brand-cream-3 px-3 py-2 text-xs font-semibold text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red disabled:opacity-40"
                >
                  {tc('actions.delete')}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {grouped.map(([module, permissions]) => (
        <section
          key={module}
          className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm"
        >
          <div className="border-b border-brand-cream-3 bg-brand-cream-1 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-red">
              {module}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
              <thead className="bg-card text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                <tr>
                  <th className="sticky left-0 z-10 min-w-64 bg-card px-4 py-3">Permission</th>
                  {matrix.roles.map((role) => (
                    <th key={role.id} className="px-4 py-3 text-center">
                      {role.name.id ?? role.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-cream-3 bg-card">
                {permissions.map((permission) => {
                  const desc = permission.description as Record<string, string> | null;
                  return (
                    <tr key={permission.id} className="hover:bg-brand-cream-1/60">
                      <td className="sticky left-0 z-10 bg-card px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-brand-ink">
                          {permission.code}
                        </p>
                        {desc && (
                          <p className="mt-0.5 text-[11px] text-brand-ink-3">
                            {desc.id ?? desc.en ?? ''}
                          </p>
                        )}
                      </td>
                      {matrix.roles.map((role) => (
                        <td key={role.id} className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isGranted(role.id, permission.id)}
                            onChange={(event) =>
                              toggle(role.id, permission.id, event.target.checked)
                            }
                            className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
                            aria-label={`${role.code} ${permission.code}`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-ink-3">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-brand-cream-3 bg-card px-2.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
      />
    </label>
  );
}
