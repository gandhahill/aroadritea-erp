'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  NAV_ACCESS,
  type NavAccessEntry,
  pagesForPermission,
  permissionsForGate,
} from '@/lib/nav-access';
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
  const tn = useTranslations('nav');
  const locale = useLocale();
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

  // All available permission codes (used by the page-to-permission reference).
  const allCodes = useMemo(() => matrix.permissions.map((p) => p.code), [matrix.permissions]);

  // Navigable pages grouped by their top-level menu section, for the reverse
  // "which permission unlocks page X?" reference table.
  const navSections = useMemo(() => {
    const map = new Map<string, NavAccessEntry[]>();
    for (const entry of NAV_ACCESS) {
      const list = map.get(entry.sectionKey) ?? [];
      list.push(entry);
      map.set(entry.sectionKey, list);
    }
    return [...map.entries()];
  }, []);

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

      <div className="rounded-xl border border-brand-jade/20 bg-brand-jade-light/40 px-4 py-3 text-sm text-brand-ink">
        <p className="font-semibold">{t('hint.title')}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-brand-ink-2">
          <li>{t('hint.perPage')}</li>
          <li>{t('hint.moduleWildcard')}</li>
          <li>{t('hint.systemWildcard')}</li>
          <li>{t('hint.pageReference')}</li>
        </ul>
      </div>

      <details className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <summary className="cursor-pointer select-none px-5 py-3 text-sm font-semibold text-brand-ink hover:bg-brand-cream-1">
          {t('pageReference.title')}
        </summary>
        <div className="space-y-4 border-t border-brand-cream-3 px-5 py-4">
          <p className="text-xs text-brand-ink-3">{t('pageReference.hint')}</p>
          {navSections.map(([sectionKey, entries]) => (
            <div key={sectionKey}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-red">
                {tn(sectionKey as never)}
              </h3>
              <table className="mt-1 w-full text-sm">
                <tbody className="divide-y divide-brand-cream-3">
                  {entries.map((entry) => {
                    const codes = permissionsForGate(entry.gate, allCodes);
                    return (
                      <tr key={entry.href} className="align-top">
                        <td className="w-1/3 py-1.5 pr-4 text-brand-ink">{tn(entry.labelKey as never)}</td>
                        <td className="py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {codes.length === 0 ? (
                              <span className="text-[11px] text-brand-ink-3">
                                {t('pageReference.systemOnly')}
                              </span>
                            ) : (
                              codes.map((code) => (
                                <code
                                  key={code}
                                  className="rounded bg-brand-cream-2 px-1.5 py-0.5 font-mono text-[11px] text-brand-ink-2"
                                >
                                  {code}
                                </code>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </details>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-brand-ink">{t('roleSectionTitle')}</h2>
          <p className="mt-1 text-sm text-brand-ink-3">{t('subtitle')}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1.3fr_1.3fr_1.3fr_auto]">
          <FilterInput
            label={tc('fields.code')}
            value={newRole.code}
            onChange={(value) => setNewRole((current) => ({ ...current, code: value }))}
            placeholder={t('placeholders.roleCode')}
          />
          <FilterInput
            label={tc('fields.nameId')}
            value={newRole.id}
            onChange={(value) => setNewRole((current) => ({ ...current, id: value }))}
            placeholder={t('placeholders.nameId')}
          />
          <FilterInput
            label={tc('fields.nameEn')}
            value={newRole.en}
            onChange={(value) => setNewRole((current) => ({ ...current, en: value }))}
            placeholder={t('placeholders.nameEn')}
          />
          <FilterInput
            label={tc('fields.nameZh')}
            value={newRole.zh}
            onChange={(value) => setNewRole((current) => ({ ...current, zh: value }))}
            placeholder={t('placeholders.nameZh')}
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
                <FilterInput
                  label={tc('fields.nameId')}
                  value={draft.id}
                  onChange={(value) =>
                    setRoleDrafts((current) => ({
                      ...current,
                      [role.id]: { ...draft, id: value },
                    }))
                  }
                />
                <FilterInput
                  label={tc('fields.nameEn')}
                  value={draft.en}
                  onChange={(value) =>
                    setRoleDrafts((current) => ({
                      ...current,
                      [role.id]: { ...draft, en: value },
                    }))
                  }
                />
                <FilterInput
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
                  <th className="sticky left-0 z-10 min-w-64 bg-card px-4 py-3">
                    {t('permissionColumn')}
                  </th>
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
                  const unlocked = pagesForPermission(permission.code);
                  return (
                    <tr key={permission.id} className="hover:bg-brand-cream-1/60">
                      <td className="sticky left-0 z-10 bg-card px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-brand-ink">
                          {permission.code}
                        </p>
                        {desc && (
                          <p className="mt-0.5 text-[11px] text-brand-ink-3">
                            {desc[locale] ?? desc.id ?? desc.en ?? ''}
                          </p>
                        )}
                        {permission.code === '*.*' ? (
                          <p className="mt-1 text-[11px] font-medium text-brand-jade">
                            {t('entireSystem')}
                          </p>
                        ) : unlocked.length > 0 ? (
                          <p className="mt-1 text-[11px] text-brand-ink-3">
                            <span className="font-semibold text-brand-ink-2">{t('unlocks')}: </span>
                            {unlocked.map((page) => tn(page.labelKey as never)).join(' / ')}
                          </p>
                        ) : null}
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
                            aria-label={t('togglePermissionLabel', {
                              role: role.code,
                              permission: permission.code,
                            })}
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

function FilterInput({
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
