import { getTranslations } from 'next-intl/server';
import { fetchNotificationChannels } from './actions';
import { NotificationChannelForm } from './notification-channel-form';
import { TableCell, TableBody, TableHead, TableHeader, Table } from "@erp/ui";
import { PageHeader } from "@/components/page-header";

export default async function NotificationSettingsPage() {
  const channels = await fetchNotificationChannels();
  const t = await getTranslations('settings.notifications');

  return (
    <main className="min-h-screen bg-brand-paper">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8 lg:px-8">
        <PageHeader 
                title={<>{t('title')}</>}
                description={<>{t('description')}</>}
                eyebrow={<>{t('section')}</>}
              />

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
            <div className="border-b border-brand-cream-3 px-5 py-4">
              <h2 className="text-base font-semibold text-brand-ink">{t('list.title')}</h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead className="px-4 py-3">{t('list.columns.label')}</TableHead>
                    <TableHead className="px-4 py-3">{t('list.columns.type')}</TableHead>
                    <TableHead className="px-4 py-3">{t('list.columns.target')}</TableHead>
                    <TableHead className="px-4 py-3">{t('list.columns.purpose')}</TableHead>
                    <TableHead className="px-4 py-3">{t('list.columns.status')}</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {channels.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-brand-ink-3">
                        {t('list.emptyState')}
                      </td>
                    </tr>
                  ) : (
                    channels.map((channel) => (
                      <tr key={channel.id}>
                        <TableCell className="px-4 py-3 font-semibold text-brand-ink">{channel.label}</TableCell>
                        <TableCell className="px-4 py-3 text-brand-muted">{channel.channelType}</TableCell>
                        <TableCell className="px-4 py-3 text-brand-muted">{channel.target}</TableCell>
                        <TableCell className="px-4 py-3 text-brand-muted">{channel.purpose}</TableCell>
                        <TableCell className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              channel.isActive
                                ? 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade'
                                : 'border-brand-cream-3 bg-brand-cream-1 text-brand-ink-3'
                            }`}
                          >
                            {channel.isActive ? t('list.status.active') : t('list.status.inactive')}
                          </span>
                        </TableCell>
                      </tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <NotificationChannelForm />
        </div>
      </section>
    </main>
  );
}
