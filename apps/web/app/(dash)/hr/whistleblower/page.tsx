import { getSession } from '@/lib/auth';
import { db, desc, eq, and, sql } from '@erp/db';
import { whistleblowerReports } from '@erp/db/schema/whistleblower';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { requirePermission } from '@erp/services/iam';
import { Pagination } from '@/components/pagination';

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
  const page = parseInt(params?.page || '1') || 1;
  const pageSize = parseInt(params?.pageSize || '20') || 20;
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

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(whistleblowerReports)
    .where(and(...conditions));

  const t = await getTranslations('whistleblower.admin');

  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-ink">{t('title') || 'Whistleblower Reports (Admin)'}</h1>
        <p className="mt-1 text-sm text-brand-ink-3">
          {t('subtitle') || 'Manage and review anonymous reports.'}
        </p>
      </div>

      <form method="GET" className="mb-6 flex items-center gap-3">
        <select
          name="status"
          defaultValue={filterStatus}
          className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-ember-5"
        >
          <option value="">{t('allStatus') || 'All Status'}</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
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
              <th className="px-4 py-3 font-semibold">{t('date') || 'Date'}</th>
              <th className="px-4 py-3 font-semibold">{t('reportTitle') || 'Title'}</th>
              <th className="px-4 py-3 font-semibold">{t('status') || 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3">
            {reports.map((report) => (
              <tr key={report.id} className="transition-colors hover:bg-brand-cream-1">
                <td className="whitespace-nowrap px-4 py-3 text-brand-ink-2">
                  {report.createdAt?.toLocaleDateString()}
                </td>
                <td className="px-4 py-3 font-medium text-brand-ink">
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
                </td>
                <td className="px-4 py-3">
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
                    {report.status}
                  </span>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-brand-ink-3">
                  {t('noReports') || 'No reports found.'}
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
    </main>
  );
}
