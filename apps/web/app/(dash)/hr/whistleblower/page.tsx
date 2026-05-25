import { FilterBar, FilterField } from '@/components/filter-bar';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { getSession } from '@/lib/auth';
import { and, db, desc, eq, sql } from '@erp/db';
import { whistleblowerReports } from '@erp/db/schema/whistleblower';
import { requirePermission } from '@erp/services/iam';
import { Button, Select, TableBody, TableCell, TableHead } from '@erp/ui';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

interface Props {
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    status?: string;
  }>;
}

export default async function AdminWhistleblowerPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  await requirePermission(session.user.id, 'hr.whistleblower.read');

  const params = await searchParams;
  const page = Number.parseInt(params?.page || '1') || 1;
  const pageSize = Number.parseInt(params?.pageSize || '20') || 20;
  const filterStatus = params?.status || '';

  const tenantId = (session.user as any).tenantId;
  const conditions = [eq(whistleblowerReports.tenantId, tenantId)];
  if (filterStatus) {
    conditions.push(eq(whistleblowerReports.status, filterStatus));
  }

  const reports = await db
    .select()
    .from(whistleblowerReports)
    .where(and(...conditions))
    .orderBy(desc(whistleblowerReports.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(whistleblowerReports)
    .where(and(...conditions));
  const count = countResult[0]?.count ?? 0;

  const t = await getTranslations('whistleblower.admin');

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('title') || 'Whistleblower Reports (Admin)'}</>}
        description={<>{t('subtitle') || 'Manage and review anonymous reports.'}</>}
      />

      <form method="GET" className="mb-6">
        <FilterBar>
          <FilterField>
            <Select name="status" defaultValue={filterStatus} className="w-full sm:w-48">
              <option value="">{t('allStatus') || 'All Status'}</option>
              <option value="open">{t('statusOpen') || 'Open'}</option>
              <option value="investigating">{t('statusInvestigating') || 'Investigating'}</option>
              <option value="resolved">{t('statusResolved') || 'Resolved'}</option>
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
              <TableHead className="px-4 py-3 font-semibold">{t('date') || 'Date'}</TableHead>
              <TableHead className="px-4 py-3 font-semibold">
                {t('reportTitle') || 'Title'}
              </TableHead>
              <TableHead className="px-4 py-3 font-semibold">{t('status') || 'Status'}</TableHead>
            </tr>
          </thead>
          <TableBody className="divide-y divide-brand-cream-3">
            {reports.map((report) => (
              <tr key={report.id} className="transition-colors hover:bg-brand-cream-1">
                <TableCell className="whitespace-nowrap px-4 py-3 text-brand-ink-2">
                  {report.createdAt?.toLocaleDateString()}
                </TableCell>
                <TableCell className="px-4 py-3 font-medium text-brand-ink">
                  <div>{report.title}</div>
                  <div className="mt-1 text-xs font-normal text-brand-ink-3">
                    {report.description.substring(0, 100)}...
                  </div>
                  {report.attachmentUrl && (
                    <a
                      href={report.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-brand-red hover:underline"
                    >
                      {t('viewEvidence') || 'View Evidence'}
                    </a>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      report.status === 'open'
                        ? 'bg-blue-50 text-blue-700'
                        : report.status === 'investigating'
                          ? 'bg-amber-50 text-amber-700'
                          : report.status === 'resolved'
                            ? 'bg-brand-jade/10 text-brand-jade'
                            : 'bg-brand-cream-3 text-brand-ink-2'
                    }`}
                  >
                    {report.status === 'open'
                      ? t('statusOpen') || 'Open'
                      : report.status === 'investigating'
                        ? t('statusInvestigating') || 'Investigating'
                        : report.status === 'resolved'
                          ? t('statusResolved') || 'Resolved'
                          : report.status}
                  </span>
                </TableCell>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-brand-ink-3">
                  {t('noReports') || 'No reports found.'}
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
  );
}
