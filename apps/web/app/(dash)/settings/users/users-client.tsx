'use client';

import { Card } from '@erp/ui';

interface User {
  id: string;
  displayName: string;
  email: string | null;
  status: string;
}

export function UsersClient({ users }: { users: User[] }) {
  return (
    <Card className="overflow-hidden border-brand-cream-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-brand-cream-2 text-brand-ink-2">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Status</th>
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
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
