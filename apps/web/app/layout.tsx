import type { Metadata, Viewport } from 'next';
import { Inter, Manrope, Noto_Sans_SC, Noto_Serif_SC } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });
const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-display' });
const notoSansSC = Noto_Sans_SC({ subsets: ['latin'], weight: ['400', '500', '700'], display: 'swap', variable: '--font-noto-sans-sc' });
const notoSerifSC = Noto_Serif_SC({ subsets: ['latin'], weight: ['400', '600', '700'], display: 'swap', variable: '--font-noto-serif-sc' });

export const metadata: Metadata = {
  title: { default: 'Aroadri Tea ERP', template: '%s — Aroadri Tea ERP' },
  description: 'Enterprise Resource Planning — PT Gandha Hill Catering Management Indonesia',
  robots: { index: false, follow: false },
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
    <html
      lang={locale}
      className={`${inter.variable} ${manrope.variable} ${notoSansSC.variable} ${notoSerifSC.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
