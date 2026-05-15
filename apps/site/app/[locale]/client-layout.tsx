'use client';
import { NextIntlClientProvider } from 'next-intl';

interface Props {
  locale: string;
  messages: Parameters<typeof NextIntlClientProvider>[0]['messages'];
  children: React.ReactNode;
}

export function ClientLayout({ locale, messages, children }: Props) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Jakarta">
      {children}
    </NextIntlClientProvider>
  );
}
