'use client';

import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import {
  Button,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@erp/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface Props {
  data: {
    total: number;
    items: Array<{
      id: string;
      number: string;
      transferDate: string;
      status: string;
      fromLocationName: string;
      toLocationName: string;
      createdByName: string | null;
      updatedByName: string | null;
    }>;
  };
  locations: Array<{ id: string; name: string }>;
  searchParams: Record<string, string>;
}

export function TransferListClient({ data, locations, searchParams }: Props) {
  const t = useTranslations('inventory.transfer');
  const tFilters = useTranslations('common.filters');
  const pagination = useTranslations('common.pagination');
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(search.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-brand-cream-3 text-brand-ink-2';
      case 'in_transit':
        return 'bg-amber-100 text-amber-700';
      case 'received':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-brand-cream-3 text-brand-ink-2';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return t('statusDraft');
      case 'in_transit':
        return t('statusInTransit');
      case 'received':
        return t('statusReceived');
      case 'cancelled':
        return t('statusCancelled');
      default:
        return status;
    }
  };

  const page = Number.parseInt(searchParams.page || '1', 10);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div className="h-full w-full overflow-y-auto space-y-6 pb-24 px-4 pt-4">
      <PageHeader
        title={<>{t('title')}</>}
        description={<>{t('subtitle')}</>}
        actions={
          <Link
            href="/inventory/transfer/new"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-red disabled:pointer-events-none disabled:opacity-50 bg-brand-red text-white shadow hover:bg-brand-red-dark h-9 px-4 py-2"
          >
            {t('new')}
          </Link>
        }
      />

      <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Select
          className="w-full sm:w-64"
          value={searchParams.locationId || ''}
          onChange={(e) => updateFilter('locationId', e.target.value)}
        >
          <option value="">{t('searchPlaceholder', { defaultValue: 'Semua Lokasi' })}</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </Select>
        <Select
          className="w-full sm:w-48"
          value={searchParams.status || ''}
          onChange={(e) => updateFilter('status', e.target.value)}
        >
          <option value="">{tFilters('allStatus')}</option>
          <option value="draft">{t('statusDraft')}</option>
          <option value="in_transit">{t('statusInTransit')}</option>
          <option value="received">{t('statusReceived')}</option>
          <option value="cancelled">{t('statusCancelled')}</option>
        </Select>
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('transferNumber')}</TableHead>
              <TableHead>{t('date')}</TableHead>
              <TableHead>{t('fromLocation')}</TableHead>
              <TableHead>{t('toLocation')}</TableHead>
              <TableHead>{t('createdBy')}</TableHead>
              <TableHead>{t('status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-brand-ink-3">
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((trf) => (
                <TableRow key={trf.id} className="group hover:bg-brand-cream-2/50">
                  <TableCell>
                    <Link
                      href={`/inventory/transfer/${trf.id}`}
                      className="font-medium text-brand-red hover:underline"
                    >
                      {trf.number}
                    </Link>
                  </TableCell>
                  <TableCell>{trf.transferDate}</TableCell>
                  <TableCell>{trf.fromLocationName}</TableCell>
                  <TableCell>{trf.toLocationName}</TableCell>
                  <TableCell>
                    <div>
                      <span className="text-sm text-brand-ink">{trf.createdByName || '—'}</span>
                      {trf.updatedByName && (
                        <span className="block text-xs text-brand-ink-3">
                          {t('editedBy', { name: trf.updatedByName })}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${getStatusColor(trf.status)}`}
                    >
                      {getStatusLabel(trf.status)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {data.total > 0 && (
          <div className="border-t border-brand-cream-3 p-4">
            <Pagination currentPage={page} totalItems={data.total} pageSize={pageSize} />
          </div>
        )}
      </section>
    </div>
  );
}
