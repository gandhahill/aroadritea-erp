'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

const OPTIONS = [
  { value: 'id', label: 'ID' },
  { value: 'en', label: 'EN' },
  { value: 'zh', label: '中文' },
];

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('shell');
  const router = useRouter();

  function changeLocale(value: string) {
    document.cookie = `aroadri.locale=${value};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-brand-ink-3">
      {t('language')}
      <select
        value={locale}
        onChange={(event) => changeLocale(event.target.value)}
        className="rounded-md border border-brand-cream-3 bg-brand-cream px-2 py-1.5 text-xs font-semibold text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
