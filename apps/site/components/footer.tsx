/**
 * Public Site Footer — SD §31.1
 */
'use client';

import { useTranslations } from 'next-intl';

interface Props {
  locale: string;
}

export function PublicFooter({ locale }: Props) {
  const t = useTranslations('common');
  const tFooter = useTranslations('footer');

  return (
    <footer className="border-t border-brand-cream-3 bg-brand-cream-3 py-8 text-center text-sm text-brand-ink-3">
      <p>{tFooter('copyright', { brand: t('brand'), year: new Date().getFullYear() })}</p>
    </footer>
  );
}
