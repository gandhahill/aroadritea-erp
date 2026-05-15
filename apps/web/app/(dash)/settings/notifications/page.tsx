import { fetchNotificationChannels } from './actions';
import { NotificationChannelForm } from './notification-channel-form';

export default async function NotificationSettingsPage() {
  const channels = await fetchNotificationChannels();

  return (
    <main className="min-h-screen bg-brand-paper">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8 lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">
            Settings
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-brand-ink">
            Notification channels
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
            Kelola penerima notifikasi operasional. Kredensial SMTP/WhatsApp tetap berada di env;
            target penerima dan purpose bisa diatur dari ERP.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
            <div className="border-b border-brand-cream-3 px-5 py-4">
              <h2 className="text-base font-semibold text-brand-ink">Daftar kanal</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
                <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  <tr>
                    <th className="px-4 py-3">Label</th>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Purpose</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-cream-3 bg-card">
                  {channels.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-brand-ink-3">
                        Belum ada kanal notifikasi.
                      </td>
                    </tr>
                  ) : (
                    channels.map((channel) => (
                      <tr key={channel.id}>
                        <td className="px-4 py-3 font-semibold text-brand-ink">{channel.label}</td>
                        <td className="px-4 py-3 text-brand-muted">{channel.channelType}</td>
                        <td className="px-4 py-3 text-brand-muted">{channel.target}</td>
                        <td className="px-4 py-3 text-brand-muted">{channel.purpose}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              channel.isActive
                                ? 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade'
                                : 'border-brand-cream-3 bg-brand-cream-1 text-brand-ink-3'
                            }`}
                          >
                            {channel.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <NotificationChannelForm />
        </div>
      </section>
    </main>
  );
}
