'use client';

import { useTranslations } from 'next-intl';

interface User {
  id: string;
  displayName: string;
  email: string | null;
  status: string;
}

export function UsersClient({ users }: { users: User[] }) {
  const t = useTranslations('settings.users');
  return (
    <div className="overflow-hidden border-brand-cream-3 rounded-xl border bg-card text-card-foreground shadow">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-brand-cream-2 text-brand-ink-2">
            <tr>
              <th className="px-4 py-3 font-semibold">{t('name')}</th>
              <th className="px-4 py-3 font-semibold">{t('email')}</th>
              <th className="px-4 py-3 font-semibold">{t('status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-brand-cream-2/50">
                <td className="px-4 py-3 font-medium text-brand-ink">{user.displayName}</td>
                <td className="px-4 py-3 text-brand-ink-2">{user.email || '-'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.status === 'active'
                        ? 'bg-brand-jade/10 text-brand-jade'
                        : 'bg-brand-ink-3/10 text-brand-ink-3'
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-brand-ink-3">
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
