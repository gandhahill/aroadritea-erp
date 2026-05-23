import { getSession } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { requirePermission } from '@erp/services/iam';
import { Pagination } from '@/components/pagination';
import { fetchGRNReport } from '../actions';
import Link from 'next/link';

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
  const page = parseInt(params?.page || '1') || 1;
  const pageSize = parseInt(params?.pageSize || '20') || 20;
  const filterStatus = params?.status || '';
  const filterLocationId = params?.locationId || '';
  const filterStartDate = params?.startDate || '';
  const filterEndDate = params?.endDate || '';

  const { data: reports, total: count, locations } = await fetchGRNReport(
    page,
    pageSize,
    filterStatus,
    filterLocationId,
    filterStartDate,
    filterEndDate
  );

  const t = await getTranslations('purchasing.grnReport');
  const tNav = await getTranslations('nav');

  return (
    <main className="min-h-screen bg-brand-paper p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-brand-ink-3">
              <Link href="/purchasing" className="hover:text-brand-ink">{tNav('purchasing')}</Link>
              <span>/</span>
              <span className="font-medium text-brand-ink">{t('title') || 'Laporan Penerimaan'}</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-brand-ink">{t('title') || 'Laporan Penerimaan (GRN)'}</h1>
            <p className="mt-1 text-sm text-brand-ink-3">
              {t('subtitle') || 'Histori penerimaan barang (Goods Receipt Note).'}
            </p>
          </div>
        </div>

        <form method="GET" className="mb-6 flex flex-wrap items-center gap-3">
          <input
            type="date"
            name="startDate"
            defaultValue={filterStartDate}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-ember-5"
          />
          <span className="text-sm text-brand-ink-3">-</span>
          <input
            type="date"
            name="endDate"
            defaultValue={filterEndDate}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-ember-5"
          />
          <select
            name="locationId"
            defaultValue={filterLocationId}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-ember-5"
          >
            <option value="">Semua Lokasi</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={filterStatus}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-ember-5"
          >
            <option value="">{t('allStatus') || 'Semua Status'}</option>
            <option value="draft">{t('statusDraft') || 'Draft'}</option>
            <option value="confirmed">{t('statusConfirmed') || 'Confirmed'}</option>
          </select>
          {params?.pageSize && <input type="hidden" name="pageSize" value={params.pageSize} />}
          <button
            type="submit"
            className="rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-cream-1"
          >
            {t('filterBtn') || 'Filter'}
          </button>
        </form>

        <div className="rounded-xl border border-brand-cream-3 bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand-cream-3 bg-brand-cream/50 text-brand-ink-2">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('receivedDate') || 'Tanggal Terima'}</th>
                <th className="px-4 py-3 font-semibold">{t('grnNumber') || 'No. GRN'}</th>
                <th className="px-4 py-3 font-semibold">{t('poNumber') || 'No. PO'}</th>
                <th className="px-4 py-3 font-semibold">{t('supplierName') || 'Supplier'}</th>
                <th className="px-4 py-3 font-semibold">{t('locationName') || 'Lokasi'}</th>
                <th className="px-4 py-3 font-semibold">{t('status') || 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3">
              {reports.map((report) => (
                <tr key={report.id} className="transition-colors hover:bg-brand-cream-1">
                  <td className="whitespace-nowrap px-4 py-3 text-brand-ink-2">
                    {report.receivedDate}
                  </td>
                  <td className="px-4 py-3 font-medium text-brand-ink">
                    {report.number}
                  </td>
                  <td className="px-4 py-3 font-medium text-brand-ink">
                    <Link href={`/purchasing/po/${report.purchaseOrderId}`} className="text-brand-red hover:underline">
                      {report.poNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-brand-ink-2">
                    {report.supplierName}
                  </td>
                  <td className="px-4 py-3 text-brand-ink-2">
                    {report.locationName}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        report.status === 'draft'
                          ? 'bg-amber-50 text-amber-700'
                          : report.status === 'confirmed'
                          ? 'bg-brand-jade/10 text-brand-jade'
                          : 'bg-brand-cream-3 text-brand-ink-2'
                      }`}
                    >
                      {report.status === 'draft' ? (t('statusDraft') || 'Draft') : report.status === 'confirmed' ? (t('statusConfirmed') || 'Confirmed') : report.status}
                    </span>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-brand-ink-3">
                    {t('noReports') || 'Tidak ada data penerimaan barang.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <Pagination
            currentPage={page}
            totalItems={Number(count)}
            pageSize={pageSize}
          />
        </div>
      </div>
    </main>
  );
}
