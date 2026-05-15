'use client';

import { useMemo, useState, useTransition } from 'react';
import { type PermissionMatrix, setRolePermission } from './actions';

export function PermissionsMatrix({ matrix }: { matrix: PermissionMatrix }) {
  const [grants, setGrants] = useState(matrix.grants);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

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
        setMessage(result.error ?? 'Gagal menyimpan permission');
      }
    });
  }

  if (!matrix.canManage) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Akun ini tidak memiliki akses untuk mengatur permission.
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
        <p className="text-xs font-medium text-brand-ink-3">Menyimpan perubahan...</p>
      ) : null}
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
                {permissions.map((permission) => (
                  <tr key={permission.id} className="hover:bg-brand-cream-1/60">
                    <td className="sticky left-0 z-10 bg-card px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-brand-ink">
                        {permission.code}
                      </p>
                    </td>
                    {matrix.roles.map((role) => (
                      <td key={role.id} className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isGranted(role.id, permission.id)}
                          onChange={(event) => toggle(role.id, permission.id, event.target.checked)}
                          className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
                          aria-label={`${role.code} ${permission.code}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
