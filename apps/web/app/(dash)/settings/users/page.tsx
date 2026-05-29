import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchUsers } from './actions';
import { UsersClient } from './users-client';

export const metadata: Metadata = {
  title: 'Users | Aroadri ERP',
};

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [users, t] = await Promise.all([
    fetchUsers(),
    getTranslations('settings.users'),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />
      <UsersClient users={users} />
    </div>
  );
}
