import type { Metadata, Viewport } from 'next';
import { Inter, Manrope, Noto_Sans_SC, Noto_Serif_SC } from 'next/font/google';
import './globals.css';

// --- Font definitions (SD §36.6) ---

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-noto-sans-sc',
});

const notoSerifSC = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-noto-serif-sc',
});

// --- Metadata ---

export const metadata: Metadata = {
  title: {
    default: 'Aroadri Tea ERP',
    template: '%s — Aroadri Tea ERP',
  },
  description: 'Enterprise Resource Planning — PT Gandha Hill Catering Management Indonesia',
  robots: { index: false, follow: false }, // ERP internal, no SEO
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#D6262E',
};

// --- Root Layout ---

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${manrope.variable} ${notoSansSC.variable} ${notoSerifSC.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
