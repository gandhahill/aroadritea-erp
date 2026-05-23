import { getSession } from '@/lib/auth';
import { db, desc, eq } from '@erp/db';
import { whistleblowerReports } from '@erp/db/schema/whistleblower';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppError } from '@erp/shared/errors';
import { requirePermission } from '@erp/services/iam';

export default async function AdminWhistleblowerPage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  await requirePermission(session.user.id, 'hr.whistleblower.read');
  
  const reports = await db
    .select()
    .from(whistleblowerReports)
    .where(eq(whistleblowerReports.tenantId, (session.user as any).tenantId))
    .orderBy(desc(whistleblowerReports.createdAt));

  const t = await getTranslations('whistleblower.admin');

  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-ink">{t('title') || 'Whistleblower Reports (Admin)'}</h1>
        <p className="mt-1 text-sm text-brand-ink-3">
          {t('subtitle') || 'Manage and review anonymous reports.'}
        </p>
      </div>

      <div className="rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-brand-cream-3 bg-brand-cream/50 text-brand-ink-2">
            <tr>
              <th className="px-4 py-3 font-semibold">{t('date') || 'Date'}</th>
              <th className="px-4 py-3 font-semibold">{t('category') || 'Category'}</th>
              <th className="px-4 py-3 font-semibold">{t('reportTitle') || 'Title'}</th>
              <th className="px-4 py-3 font-semibold">{t('status') || 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3">
            {reports.map((report) => (
              <tr key={report.id} className="transition-colors hover:bg-brand-cream-1">
                <td className="px-4 py-3 whitespace-nowrap text-brand-ink-2">
                  {report.createdAt?.toLocaleDateString()}
                </td>
                <td className="px-4 py-3 font-medium text-brand-ink">{report.title}</td>
                <td className="px-4 py-3 capitalize text-brand-ink">
                  {/* description holds both category and details. We just show a snippet */}
                  <div className="mb-1">{report.description.substring(0, 50)}...</div>
                  {report.attachmentUrl && (
                    <a
                      href={report.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-brand-red hover:underline"
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
                <td colSpan={4} className="px-4 py-8 text-center text-brand-ink-3">
                  {t('noReports') || 'No reports found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
