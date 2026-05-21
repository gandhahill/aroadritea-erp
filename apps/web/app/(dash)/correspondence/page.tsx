import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createCorrespondenceAction, fetchCorrespondencePageData } from './actions';
import { FileUploadField } from '@/components/file-upload-field';

export const dynamic = 'force-dynamic';

const INPUT =
  'w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5';

const DIRECTIONS = ['incoming', 'outgoing', 'internal'] as const;
const CHANNELS = ['physical', 'email', 'whatsapp', 'courier', 'other'] as const;
const CLASSIFICATIONS = ['general', 'legal', 'finance', 'hr', 'procurement', 'tax', 'other'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
const STATUSES = ['draft', 'registered', 'in_progress', 'sent', 'closed', 'archived'] as const;

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    direction?: string;
    classification?: string;
    error?: string;
    deleted?: string;
  }>;
}

export default async function CorrespondencePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [t, actions, pagination, data] = await Promise.all([
    getTranslations('correspondence'),
    getTranslations('common.actions'),
    getTranslations('common.pagination'),
    fetchCorrespondencePageData(params),
  ]);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">
            {t('eyebrow')}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-brand-ink">{t('title')}</h1>
          <p className="mt-1 max-w-3xl text-sm text-brand-ink-3">{t('subtitle')}</p>
        </div>
      </div>

      {params.error || data.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {params.error ?? data.error}
        </div>
      ) : null}
      {params.deleted ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {t('deleted')}
        </div>
      ) : null}

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{t('newRecord')}</h2>
        <form action={createCorrespondenceAction} className="mt-4 grid gap-4 lg:grid-cols-4">
          <Field label={t('fields.location')}>
            <select name="locationId" className={INPUT} required>
              {data.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('fields.direction')}>
            <OptionSelect name="direction" values={DIRECTIONS} t={t} group="directions" />
          </Field>
          <Field label={t('fields.documentNo')}>
            <input name="documentNo" className={INPUT} required />
          </Field>
          <Field label={t('fields.documentDate')}>
            <input name="documentDate" type="date" className={INPUT} required />
          </Field>
          <div className="lg:col-span-2">
            <Field label={t('fields.subject')}>
              <input name="subject" className={INPUT} required />
            </Field>
          </div>
          <Field label={t('fields.counterparty')}>
            <input name="counterparty" className={INPUT} />
          </Field>
          <Field label={t('fields.dueDate')}>
            <input name="dueDate" type="date" className={INPUT} />
          </Field>
          <Field label={t('fields.channel')}>
            <OptionSelect name="channel" values={CHANNELS} t={t} group="channels" />
          </Field>
          <Field label={t('fields.classification')}>
            <OptionSelect name="classification" values={CLASSIFICATIONS} t={t} group="classifications" />
          </Field>
          <Field label={t('fields.priority')}>
            <OptionSelect name="priority" values={PRIORITIES} t={t} group="priorities" />
          </Field>
          <Field label={t('fields.owner')}>
            <select name="ownerUserId" className={INPUT} defaultValue="">
              <option value="">{t('unassigned')}</option>
              {data.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label}
                </option>
              ))}
            </select>
          </Field>
          <FileUploadField
            label={t('fields.storageUrl')}
            hiddenName="storageUrl"
            area="correspondence"
            visibility="private"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
          />
          <Field label={t('fields.tags')}>
            <input name="tags" className={INPUT} placeholder={t('tagsPlaceholder')} />
          </Field>
          <div className="lg:col-span-3">
            <Field label={t('fields.summary')}>
              <textarea name="summary" rows={3} className={INPUT} />
            </Field>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark"
            >
              {actions('save')}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-brand-cream-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-semibold text-brand-ink">{t('register')}</h2>
          <div className="flex flex-wrap gap-2">
            <FilterLink href="/correspondence" active={!params.status && !params.direction}>
              {t('filters.all')}
            </FilterLink>
            {DIRECTIONS.map((direction) => (
              <FilterLink
                key={direction}
                href={`/correspondence?direction=${direction}${params.classification ? `&classification=${params.classification}` : ''}`}
                active={params.direction === direction}
              >
                {t(`directions.${direction}`)}
              </FilterLink>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
            <thead className="bg-brand-cream">
              <tr className="text-left text-brand-ink-2">
                <Th>{t('fields.documentNo')}</Th>
                <Th>{t('fields.subject')}</Th>
                <Th>{t('fields.direction')}</Th>
                <Th>{t('fields.documentDate')}</Th>
                <Th>{t('fields.dueDate')}</Th>
                <Th>{t('fields.status')}</Th>
                <Th>{t('fields.priority')}</Th>
                <Th>{t('open')}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-brand-ink-3">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id} className="text-brand-ink">
                    <Td>{item.documentNo}</Td>
                    <Td>{item.subject}</Td>
                    <Td>{t(`directions.${item.direction}`)}</Td>
                    <Td>{item.documentDate}</Td>
                    <Td>{item.dueDate ?? '-'}</Td>
                    <Td>{t(`statuses.${item.status}`)}</Td>
                    <Td>{t(`priorities.${item.priority}`)}</Td>
                    <Td>
                      <Link className="font-semibold text-brand-red" href={`/correspondence/${item.id}`}>
                        {t('open')}
                      </Link>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-brand-cream-3 px-5 py-3 text-xs text-brand-ink-3">
          <span>
            {t('total', { count: data.total })} - {pagination('page')} {data.page} {pagination('of')}{' '}
            {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <PageLink page={data.page - 1} disabled={data.page <= 1} params={params}>
              {pagination('previous')}
            </PageLink>
            <PageLink page={data.page + 1} disabled={data.page >= totalPages} params={params}>
              {pagination('next')}
            </PageLink>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-brand-ink">{label}</span>
      {children}
    </label>
  );
}

function OptionSelect({
  name,
  values,
  t,
  group,
}: {
  name: string;
  values: readonly string[];
  t: Awaited<ReturnType<typeof getTranslations>>;
  group: string;
}) {
  return (
    <select name={name} className={INPUT}>
      {values.map((value) => (
        <option key={value} value={value}>
          {t(`${group}.${value}`)}
        </option>
      ))}
    </select>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-3">{children}</td>;
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-brand-red bg-brand-red text-white'
          : 'border-brand-cream-3 text-brand-ink hover:bg-brand-cream'
      }`}
    >
      {children}
    </Link>
  );
}

function PageLink({
  page,
  disabled,
  params,
  children,
}: {
  page: number;
  disabled: boolean;
  params: Awaited<PageProps['searchParams']>;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="rounded-md border border-brand-cream-3 px-3 py-1.5 opacity-50">{children}</span>;
  }
  const query = new URLSearchParams();
  query.set('page', String(page));
  if (params.status) query.set('status', params.status);
  if (params.direction) query.set('direction', params.direction);
  if (params.classification) query.set('classification', params.classification);
  return (
    <Link href={`/correspondence?${query.toString()}`} className="rounded-md border border-brand-cream-3 px-3 py-1.5">
      {children}
    </Link>
  );
}
