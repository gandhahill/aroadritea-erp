'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface Props {
  href: string;
  periodCode: string;
}

/**
 * Payslip row actions: in-page preview (iframe modal, like the SOP viewer)
 * plus open-in-new-tab. The payslip route returns a print-ready HTML
 * document, so the browser's "Save as PDF" produces the file.
 */
export function PayslipActions({ href, periodCode }: Props) {
  const t = useTranslations('hr.payslip');
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-brand-red px-3 py-1 text-xs font-medium text-white hover:bg-brand-red-dark"
        >
          {t('preview', { defaultValue: 'Pratinjau' })}
        </button>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-brand-cream-3 px-3 py-1 text-xs text-brand-ink hover:bg-brand-cream-2"
        >
          {t('download')}
        </a>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-2xl">
            <header className="flex items-center justify-between gap-4 border-b border-brand-cream-3 px-5 py-4">
              <h2 className="truncate text-base font-semibold text-brand-ink">
                {t('title')} · {periodCode}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-brand-cream-3 px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-cream-2"
                >
                  {t('openInNewTab', { defaultValue: 'Buka di tab baru' })}
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-brand-cream-3 px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-cream-2"
                >
                  {t('close', { defaultValue: 'Tutup' })}
                </button>
              </div>
            </header>
            <iframe
              src={href}
              title={`${t('title')} ${periodCode}`}
              className="min-h-0 flex-1 border-0 bg-brand-cream"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
