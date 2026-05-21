import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  deleteCorrespondenceAction,
  fetchCorrespondenceDetail,
  updateCorrespondenceAction,
} from '../actions';
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
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}

export default async function CorrespondenceDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, query, t, actions] = await Promise.all([
    params,
    searchParams,
    getTranslations('correspondence'),
    getTranslations('common.actions'),
  ]);
  const data = await fetchCorrespondenceDetail(id);
  const record = data.record;
  const updateAction = updateCorrespondenceAction.bind(null, id);
  const deleteAction = deleteCorrespondenceAction.bind(null, id);

  if (!record) {
    return (
      <div className="space-y-4">
        <Link href="/correspondence" className="text-sm font-semibold text-brand-red">
          {t('back')}
        </Link>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {query.error ?? data.error ?? t('notFound')}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/correspondence" className="text-sm font-semibold text-brand-red">
            {t('back')}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-brand-ink">{record.documentNo}</h1>
          <p className="mt-1 text-sm text-brand-ink-3">{record.subject}</p>
        </div>
        <span className="rounded-full border border-brand-cream-3 px-3 py-1 text-xs font-semibold text-brand-ink-2">
          {t(`statuses.${record.status}`)}
        </span>
      </div>

      {query.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {query.error}
        </div>
      ) : null}
      {query.saved ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {t('saved')}
        </div>
      ) : null}

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <form action={updateAction} className="grid gap-4 lg:grid-cols-4">
          <Field label={t('fields.location')}>
            <select name="locationId" className={INPUT} defaultValue={record.locationId} required>
              {data.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('fields.direction')}>
            <OptionSelect name="direction" values={DIRECTIONS} t={t} group="directions" defaultValue={record.direction} />
          </Field>
          <Field label={t('fields.status')}>
            <OptionSelect name="status" values={STATUSES} t={t} group="statuses" defaultValue={record.status} />
          </Field>
          <Field label={t('fields.documentDate')}>
            <input name="documentDate" type="date" className={INPUT} defaultValue={record.documentDate} required />
          </Field>
          <Field label={t('fields.documentNo')}>
            <input name="documentNo" className={INPUT} defaultValue={record.documentNo} required />
          </Field>
          <div className="lg:col-span-2">
            <Field label={t('fields.subject')}>
              <input name="subject" className={INPUT} defaultValue={record.subject} required />
            </Field>
          </div>
          <Field label={t('fields.counterparty')}>
            <input name="counterparty" className={INPUT} defaultValue={record.counterparty ?? ''} />
          </Field>
          <Field label={t('fields.dueDate')}>
            <input name="dueDate" type="date" className={INPUT} defaultValue={record.dueDate ?? ''} />
          </Field>
          <Field label={t('fields.channel')}>
            <OptionSelect name="channel" values={CHANNELS} t={t} group="channels" defaultValue={record.channel} />
          </Field>
          <Field label={t('fields.classification')}>
            <OptionSelect
              name="classification"
              values={CLASSIFICATIONS}
              t={t}
              group="classifications"
              defaultValue={record.classification}
            />
          </Field>
          <Field label={t('fields.priority')}>
            <OptionSelect name="priority" values={PRIORITIES} t={t} group="priorities" defaultValue={record.priority} />
          </Field>
          <Field label={t('fields.owner')}>
            <select name="ownerUserId" className={INPUT} defaultValue={record.ownerUserId ?? ''}>
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
            value={record.storageUrl}
            area="correspondence"
            visibility="private"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
          />
          <Field label={t('fields.tags')}>
            <input name="tags" className={INPUT} defaultValue={record.tags.join(', ')} />
          </Field>
          <div className="lg:col-span-4">
            <Field label={t('fields.summary')}>
              <textarea name="summary" rows={5} className={INPUT} defaultValue={record.summary ?? ''} />
            </Field>
          </div>
          <div className="flex flex-col gap-2 lg:col-span-4 sm:flex-row sm:justify-end">
            <button
              formAction={deleteAction}
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
            >
              {actions('delete')}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-brand-red px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark"
            >
              {actions('save')}
            </button>
          </div>
        </form>
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
  defaultValue,
}: {
  name: string;
  values: readonly string[];
  t: Awaited<ReturnType<typeof getTranslations>>;
  group: string;
  defaultValue?: string;
}) {
  return (
    <select name={name} className={INPUT} defaultValue={defaultValue}>
      {values.map((value) => (
        <option key={value} value={value}>
          {t(`${group}.${value}`)}
        </option>
      ))}
    </select>
  );
}
