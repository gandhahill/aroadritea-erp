/**
 * Locale Layout — provides i18n context for all pages.
 * SD §31.1, ADR-0003.
 */
import type { Metadata } from 'next';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PublicFooter } from '../../components/footer';
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

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col bg-cream-50">
        <ClientLayout locale={locale as SiteLocale} messages={messages}>
          <PublicHeader
            locale={locale as SiteLocale}
            brand={brand}
            labels={{
              home: nav('home'),
              menu: nav('menu'),
              about: nav('about'),
              locations: nav('locations'),
            }}
          />
          <main className="flex-1">{children}</main>
          <PublicFooter
            copyright={footer('copyright', { brand, year: new Date().getFullYear() })}
          />
        </ClientLayout>
      </body>
    </html>
  );
}

export function generateMetadata(): Metadata {
  return {
    title: { default: 'Aroadri Tea', template: '%s | Aroadri Tea' },
    description: 'Chinese-style bubble tea & dessert in Yogyakarta',
    metadataBase: new URL('https://aroadritea.com'),
  };
}
