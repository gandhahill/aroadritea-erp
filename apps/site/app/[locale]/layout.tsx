/**
 * Locale Layout — provides i18n context for all pages.
 * SD §31.1, ADR-0003.
 */
import type { Metadata } from 'next';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { siteLocales, type SiteLocale } from '../../i18n';
import { PublicHeader } from '../../components/header';
import { PublicFooter } from '../../components/footer';
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

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col bg-cream-50">
        <ClientLayout locale={locale as SiteLocale} messages={messages}>
          <PublicHeader locale={locale as SiteLocale} />
          <main className="flex-1">{children}</main>
          <PublicFooter locale={locale as SiteLocale} />
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
