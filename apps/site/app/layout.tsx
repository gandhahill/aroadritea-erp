import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aroadri Tea',
  description: 'Chinese-style bubble tea & dessert',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
