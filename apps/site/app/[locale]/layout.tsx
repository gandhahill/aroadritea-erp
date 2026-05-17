/**
 * Locale Layout — provides i18n context for all pages.
 * SD §31.1, ADR-0003.
 */
import type { Metadata } from 'next';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Montserrat } from 'next/font/google';
import { notFound } from 'next/navigation';

// Brand wordmark "Aroadri Tea" must be rendered in Montserrat ExtraBold
// per BRAND.md guideline. Self-hosted via next/font so it does not
// depend on a runtime Google Fonts request.
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['800'],
  display: 'swap',
  variable: '--font-brand-wordmark',
});
import { getMemberAccount } from '../../actions/member';
import { PublicFooter, type SocialLink } from '../../components/footer';
import { PublicHeader } from '../../components/header';
import { type SiteLocale, siteLocales } from '../../i18n';
import { ClientLayout } from './client-layout';

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateStaticParams() {
  return siteLocales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!siteLocales.includes(locale as SiteLocale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages({ locale });
  const nav = await getTranslations({ locale, namespace: 'nav' });
  const common = await getTranslations({ locale, namespace: 'common' });
  const footer = await getTranslations({ locale, namespace: 'footer' });
  const brand = common('brand');
  const tagline = common('tagline');
  const chineseTea = common('chineseTea');

  // Check member session for auth-aware header
  const memberAccount = await getMemberAccount();
  const isLoggedIn = !!memberAccount;
  const memberName = memberAccount?.memberName ?? null;

  return (
    <html lang={locale} className={montserrat.variable}>
      <body className="flex min-h-screen flex-col bg-cream-50">
        <ClientLayout locale={locale as SiteLocale} messages={messages}>
          <PublicHeader
            locale={locale as SiteLocale}
            brand={brand}
            tagline={tagline}
            chineseTea={chineseTea}
            isLoggedIn={isLoggedIn}
            memberName={memberName}
            labels={{
              home: nav('home'),
              menu: nav('menu'),
              about: nav('about'),
              locations: nav('locations'),
              careers: nav('careers'),
              member: nav('member'),
              login: nav('login'),
              myAccount: nav('myAccount'),
            }}
          />
          <main className="flex-1">{children}</main>
          <PublicFooter
            brand={brand}
            tagline={tagline}
            company={footer('company')}
            locationLine={footer('locationLine')}
            socialLabel={footer('socialLabel')}
            socials={socialsForLocale(locale as SiteLocale, {
              instagram: footer('instagramLabel'),
              tiktok: footer('tiktokLabel'),
              xiaohongshu: footer('xiaohongshuLabel'),
              douyin: footer('douyinLabel'),
            })}
            copyright={footer('copyright', { brand, year: new Date().getFullYear() })}
          />
        </ClientLayout>
      </body>
    </html>
  );
}

// Instagram/TikTok are blocked in mainland China. For zh visitors we
// surface Xiaohongshu (小红书) and Douyin (抖音) — both reachable inside
// China without a VPN. The username slugs below are placeholders that
// can be updated once the brand registers official Chinese accounts.
function socialsForLocale(
  locale: SiteLocale,
  labels: { instagram: string; tiktok: string; xiaohongshu: string; douyin: string },
): SocialLink[] {
  if (locale === 'zh') {
    return [
      {
        kind: 'xiaohongshu',
        label: labels.xiaohongshu,
        href: 'https://www.xiaohongshu.com/search_result?keyword=Aroadri%20Tea',
      },
      {
        kind: 'douyin',
        label: labels.douyin,
        href: 'https://www.douyin.com/search/Aroadri%20Tea',
      },
    ];
  }
  return [
    { kind: 'instagram', label: labels.instagram, href: 'https://www.instagram.com/aroadri.tea/' },
    { kind: 'tiktok', label: labels.tiktok, href: 'https://www.tiktok.com/@aroadri.tea' },
  ];
}

export function generateMetadata(): Metadata {
  return {
    title: { default: 'Aroadri Tea', template: '%s | Aroadri Tea' },
    description: 'Nature Aroma in Every Sip - Chinese-style tea and dessert in Yogyakarta',
    metadataBase: new URL('https://aroadritea.com'),
    icons: {
      icon: '/brand/logo-favicon.svg',
      shortcut: '/brand/logo-favicon.svg',
      apple: '/brand/logo-primary.png',
    },
  };
}
