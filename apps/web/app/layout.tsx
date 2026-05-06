import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aroadri Tea ERP',
  description: 'Enterprise Resource Planning - PT Gandha Hill Catering Management Indonesia',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
