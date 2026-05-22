'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface Props {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('common.pagination');

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', newPageSize);
    params.set('page', '1'); // Reset to page 1 on page size change
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-brand-cream-3 bg-card px-4 py-3 text-sm text-brand-ink-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span>{t('show')}</span>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="rounded border border-brand-cream-3 bg-white px-2 py-1 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red/20"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>{t('rows')}</span>
        </div>
        <span className="hidden text-brand-cream-3 sm:inline">|</span>
        <span>
          {t('page')} {currentPage} {t('of')} {totalPages} ({totalItems} total)
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => handlePageChange(1)}
          disabled={!hasPrevious}
          className="rounded-md border border-brand-cream-3 px-2 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-cream disabled:opacity-50 disabled:hover:bg-transparent"
          title="Ke halaman pertama"
        >
          &laquo;
        </button>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={!hasPrevious}
          className="rounded-md border border-brand-cream-3 px-3 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-cream disabled:opacity-50 disabled:hover:bg-transparent"
        >
          {t('previous')}
        </button>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={!hasNext}
          className="rounded-md border border-brand-cream-3 px-3 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-cream disabled:opacity-50 disabled:hover:bg-transparent"
        >
          {t('next')}
        </button>
        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={!hasNext}
          className="rounded-md border border-brand-cream-3 px-2 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-cream disabled:opacity-50 disabled:hover:bg-transparent"
          title="Ke halaman terakhir"
        >
          &raquo;
        </button>
      </div>
    </div>
  );
}
