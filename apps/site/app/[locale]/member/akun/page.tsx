/**
 * Member Account Page — SD §31.7
 * Point balance, QR card, points history, vouchers.
 */
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getMemberAccount, logoutAction } from '../../../../actions/member';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'id' ? 'Akun Saya' : locale === 'zh' ? '我的账户' : 'My Account',
  };
}

export default async function MemberAccountPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'member' });
  const member = await getMemberAccount();

  if (!member) {
    redirect(`/${locale}/member/daftar`);
  }

  const loyalty = member.loyalty as Record<string, unknown> | null;
  const points = (loyalty?.points as number) ?? 0;
  const tier = ((loyalty?.tier as string) ?? 'bronze').toUpperCase();
  const lifetimePoints = (loyalty?.lifetimePoints as number) ?? 0;
  const pointsHistory = member.pointsHistory as Array<Record<string, unknown>>;
  const vouchers = member.vouchers as Array<Record<string, unknown>>;

  const tierColors: Record<string, string> = {
    BRONZE: 'bg-amber-100 text-amber-800',
    SILVER: 'bg-gray-200 text-gray-800',
    GOLD: 'bg-yellow-100 text-yellow-800',
  };

  const tierBg = tierColors[tier] ?? 'bg-amber-100 text-amber-800';

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <form action={logoutAction}>
          <button type="submit" className="rounded-md border border-brand-cream-3 px-4 py-2 text-sm text-brand-ink-2 hover:bg-brand-cream-1">
            {t('logout')}
          </button>
        </form>
      </div>

      {/* Loyalty Card */}
      <div className="mt-8 rounded-2xl bg-gradient-to-br from-brand-red to-red-700 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-red-100">{t('memberId')}</p>
            <p className="mt-1 font-mono text-xs text-red-200">{member.memberId.slice(0, 12)}…</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${tier === 'GOLD' ? 'bg-yellow-300 text-yellow-900' : tier === 'SILVER' ? 'bg-gray-300 text-gray-900' : 'bg-amber-200 text-amber-900'}`}>
            {tier}
          </span>
        </div>
        <div className="mt-6">
          <p className="text-sm text-red-100">{t('availablePoints')}</p>
          <p className="mt-1 text-4xl font-bold">{points.toLocaleString(locale === 'id' ? 'id-ID' : locale === 'zh' ? 'zh-CN' : 'en-US')}</p>
        </div>
        <div className="mt-4 flex items-center gap-4 text-sm text-red-100">
          <span>{t('lifetimePoints')}: {lifetimePoints.toLocaleString(locale === 'id' ? 'id-ID' : locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
        </div>
      </div>

      {/* Points History */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-brand-ink">{t('pointsHistory')}</h2>
        {pointsHistory.length === 0 ? (
          <p className="text-sm text-brand-ink-3">{t('noHistory')}</p>
        ) : (
          <div className="space-y-2">
            {pointsHistory.slice(0, 10).map((item) => {
              const pts = item.points as number;
              const isEarn = pts > 0;
              return (
                <div key={item.id as string} className="flex items-center justify-between rounded-lg border border-brand-cream-3 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-brand-ink">{(item.description as Record<string, string>)?.[locale] ?? (item.description as Record<string, string>)?.id ?? '—'}</p>
                    <p className="text-xs text-brand-ink-3">{item.createdAt ? new Date(item.createdAt as string).toLocaleDateString(locale === 'id' ? 'id-ID' : locale === 'zh' ? 'zh-CN' : 'en-US') : '—'}</p>
                  </div>
                  <span className={`text-sm font-bold ${isEarn ? 'text-brand-jade' : 'text-brand-red'}`}>
                    {isEarn ? '+' : ''}{pts.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Vouchers */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-brand-ink">{t('vouchers')}</h2>
        {vouchers.length === 0 ? (
          <p className="text-sm text-brand-ink-3">{t('noVouchers')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {vouchers.map((v) => {
              const kind = v.kind as string;
              const val = v.value as number;
              let label = '';
              if (kind === 'discount_percent') label = `${val}% OFF`;
              else if (kind === 'discount_fixed') label = `Rp${val.toLocaleString()}`;
              else if (kind === 'free_delivery') label = locale === 'id' ? 'Gratis Ongkir' : locale === 'zh' ? '免配送' : 'Free Delivery';
              else label = `${val}`;
              return (
                <div key={v.id as string} className="rounded-lg border-2 border-dashed border-brand-gold bg-brand-gold/5 p-4 text-center">
                  <p className="text-lg font-bold text-brand-gold">{label}</p>
                  <p className="mt-1 text-xs text-brand-ink-3">
                    {v.validUntil ? `→ ${new Date(v.validUntil as string).toLocaleDateString(locale === 'id' ? 'id-ID' : locale === 'zh' ? 'zh-CN' : 'en-US', { day: '2-digit', month: 'short' })}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Code placeholder */}
      <div className="mt-8 rounded-lg border border-brand-cream-3 bg-white p-6 text-center">
        <p className="mb-4 text-sm text-brand-ink-3">{t('memberCard')}</p>
        <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-lg bg-brand-cream-2 text-brand-cream-3">
          <svg className="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        </div>
        <p className="mt-3 text-xs text-brand-ink-3">QR Code — {t('scanAtStore')}</p>
      </div>
    </div>
  );
}