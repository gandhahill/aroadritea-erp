import { getSession } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AccountSettingsClient } from './account-settings-client';
import { listMySessions } from './actions';
import { SessionsSection } from './sessions-section';

export async function generateMetadata() {
  const t = await getTranslations('account');
  return { title: t('title') };
}

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const sessions = await listMySessions();

  return (
    <div className="space-y-6">
      <AccountSettingsClient
        user={{
          displayName: String(user.name ?? user.displayName ?? ''),
          email: String(user.email ?? ''),
          locale: String(user.locale ?? 'id'),
        }}
      />
      <div className="mx-auto max-w-3xl px-6 pb-10">
        <SessionsSection sessions={sessions} />
      </div>
    </div>
  );
}
