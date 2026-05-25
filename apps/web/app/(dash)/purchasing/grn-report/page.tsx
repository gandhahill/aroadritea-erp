import { FilterBar, FilterField } from '@/components/filter-bar';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { getSession } from '@/lib/auth';
import { requirePermission } from '@erp/services/iam';
import { Button, Input, Select, TableBody, TableCell, TableHead } from '@erp/ui';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchGRNReport } from '../actions';

interface Props {
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    status?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function GRNReportPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  await requirePermission(session.user.id, 'purchasing.view');

  const params = await searchParams;
  const page = Number.parseInt(params?.page || '1') || 1;
  const pageSize = Number.parseInt(params?.pageSize || '20') || 20;
  const filterStatus = params?.status || '';
  const filterLocationId = params?.locationId || '';
  const filterStartDate = params?.startDate || '';
  const filterEndDate = params?.endDate || '';

  const {
    data: reports,
    total: count,
    locations,
  } = await fetchGRNReport(
    page,
    pageSize,
    filterStatus,
    filterLocationId,
    filterStartDate,
    filterEndDate,
  );

  const t = await getTranslations('purchasing.grnReport');
  const tNav = await getTranslations('nav');

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title={<>{t('title') || 'Laporan Penerimaan (GRN)'}</>}
          description={<>{t('subtitle') || 'Histori penerimaan barang (Goods Receipt Note).'}</>}
          eyebrow={
            <div className="flex items-center gap-2 text-sm text-brand-ink-3">
              <Link href="/purchasing" className="hover:text-brand-ink">
                {tNav('purchasing')}
              </Link>
              <span>/</span>
              <span className="font-medium text-brand-ink">
                {t('title') || 'Laporan Penerimaan'}
              </span>
            </div>
          }
        />

        <form method="GET" className="mb-6">
          <FilterBar>
            <FilterField>
              <Input type="date" name="startDate" defaultValue={filterStartDate} />
            </FilterField>
            <span className="text-sm text-brand-ink-3">-</span>
            <FilterField>
              <Input type="date" name="endDate" defaultValue={filterEndDate} />
            </FilterField>
            <FilterField>
              <Select name="locationId" defaultValue={filterLocationId} className="w-full sm:w-48">
                <option value="">{t('allLocations')}</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField>
              <Select name="status" defaultValue={filterStatus} className="w-full sm:w-48">
                <option value="">{t('allStatus') || 'Semua Status'}</option>
                <option value="draft">{t('statusDraft') || 'Draft'}</option>
                <option value="confirmed">{t('statusConfirmed') || 'Confirmed'}</option>
              </Select>
            </FilterField>
            {params?.pageSize && <input type="hidden" name="pageSize" value={params.pageSize} />}
            <Button type="submit" variant="primary" className="h-9">
              {t('filterBtn') || 'Filter'}
            </Button>
          </FilterBar>
        </form>

        <div className="rounded-xl border border-brand-cream-3 bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand-cream-3 bg-brand-cream/50 text-brand-ink-2">
              <tr>
                <TableHead className="px-4 py-3 font-semibold">
                  {t('receivedDate') || 'Tanggal Terima'}
                </TableHead>
                <TableHead className="px-4 py-3 font-semibold">
                  {t('grnNumber') || 'No. GRN'}
                </TableHead>
                <TableHead className="px-4 py-3 font-semibold">
                  {t('poNumber') || 'No. PO'}
                </TableHead>
                <TableHead className="px-4 py-3 font-semibold">
                  {t('supplierName') || 'Supplier'}
                </TableHead>
                <TableHead className="px-4 py-3 font-semibold">
                  {t('locationName') || 'Lokasi'}
                </TableHead>
                <TableHead className="px-4 py-3 font-semibold">{t('status') || 'Status'}</TableHead>
              </tr>
            </thead>
            <TableBody className="divide-y divide-brand-cream-3">
              {reports.map((report) => (
                <tr key={report.id} className="transition-colors hover:bg-brand-cream-1">
                  <TableCell className="whitespace-nowrap px-4 py-3 text-brand-ink-2">
                    {report.receivedDate}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-medium text-brand-ink">
                    {report.number}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-medium text-brand-ink">
                    <Link
                      href={`/purchasing/po/${report.purchaseOrderId}`}
                      className="text-brand-red hover:underline"
                    >
                      {report.poNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-brand-ink-2">
                    {report.supplierName}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-brand-ink-2">
                    {report.locationName}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        report.status === 'draft'
                          ? 'bg-amber-50 text-amber-700'
                          : report.status === 'confirmed'
                            ? 'bg-brand-jade/10 text-brand-jade'
                            : 'bg-brand-cream-3 text-brand-ink-2'
                      }`}
                    >
                      {report.status === 'draft'
                        ? t('statusDraft') || 'Draft'
                        : report.status === 'confirmed'
                          ? t('statusConfirmed') || 'Confirmed'
                          : report.status}
                    </span>
                  </TableCell>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-brand-ink-3">
                    {t('noReports') || 'Tidak ada data penerimaan barang.'}
                  </td>
                </tr>
              )}
            </TableBody>
          </table>
        </div>

        <div className="mt-6">
          <Pagination currentPage={page} totalItems={Number(count)} pageSize={pageSize} />
        </div>
      </div>
    </div>
  );
}
