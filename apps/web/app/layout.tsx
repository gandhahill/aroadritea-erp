import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import RegisterPWA from './register-pwa';

export const metadata: Metadata = {
  title: { default: 'Aroadri Tea ERP', template: '%s — Aroadri Tea ERP' },
  description: 'Enterprise Resource Planning — PT Gandha Hill Catering Management Indonesia',
  robots: { index: false, follow: false },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Aroadri POS',
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#D6262E',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Jakarta">
          <RegisterPWA />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
