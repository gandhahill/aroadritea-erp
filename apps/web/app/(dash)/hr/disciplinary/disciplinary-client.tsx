/**
 * Disciplinary Actions Page — SD §21.8 §Surat Peringatan
 *
 * Lists SP1/SP2/SP3 records + form to create new one.
 */

'use client';

import { FileUploadField } from '@/components/file-upload-field';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import {
  acknowledgeDisciplinaryActionAction,
  createDisciplinaryActionAction,
  listDisciplinaryActionsAction,
} from './actions';
import { Button, Input, Select } from "@erp/ui";
import { PageHeader } from "@/components/page-header";

const LEVEL_LABEL: Record<string, { short: string; color: string; desc: string }> = {
  SP1: { short: 'SP1', color: 'bg-brand-gold/10 text-brand-gold', desc: 'Surat Peringatan 1' },
  SP2: { short: 'SP2', color: 'bg-orange-50 text-orange-600', desc: 'Surat Peringatan 2' },
  SP3: { short: 'SP3', color: 'bg-brand-rose-4/10 text-brand-rose-4', desc: 'Surat Peringatan 3' },
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  issued: { label: 'Diterbitkan', color: 'bg-brand-gold/10 text-brand-gold' },
  acknowledged: { label: 'Ditekankan', color: 'bg-brand-jade/10 text-brand-jade' },
  escalated: { label: 'Dieselakan', color: 'bg-brand-rose-4/10 text-brand-rose-4' },
};

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface DisciplinaryRow {
  id: string;
  employeeId: string;
  employeeName: string | null;
  level: string;
  reason: string;
  incidentDate: string;
  status: string;
  issuedBy: string;
  issuedByName: string | null;
  attachmentUrl: string | null;
}

interface Props {
  initialActions: DisciplinaryRow[];
  employees: { value: string; label: string }[];
}

export function DisciplinaryClient({ initialActions, employees }: Props) {
  const t = useTranslations('hr.disciplinary');
  const tc = useTranslations('common');
  const [isPending, startTransition] = useTransition();
  const [filterLevel, setFilterLevel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [actions, setActions] = useState<DisciplinaryRow[]>(initialActions);

  // Form state
  const [employeeId, setEmployeeId] = useState('');
  const [level, setLevel] = useState<'SP1' | 'SP2' | 'SP3'>('SP1');
  const [reason, setReason] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  function handleFilter() {
    startTransition(async () => {
      const result = await listDisciplinaryActionsAction({
        level: (filterLevel || undefined) as 'SP1' | 'SP2' | 'SP3' | undefined,
        status: (filterStatus || undefined) as 'issued' | 'acknowledged' | 'escalated' | undefined,
      });
      if (result.ok) {
        setActions(result.value as unknown as DisciplinaryRow[]);
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!employeeId || !reason || !incidentDate) {
      setFormError('Semua field wajib diisi.');
      return;
    }

    const result = await createDisciplinaryActionAction({
      employeeId,
      level,
      reason,
      incidentDate: `${incidentDate}T00:00:00.000Z`,
      attachmentUrl: attachmentUrl || undefined,
    });

    if (result.ok) {
      setFormSuccess(`${level} berhasil diterbitkan.`);
      setReason('');
      setAttachmentUrl('');
      setIncidentDate('');
      setShowForm(false);
      handleFilter();
    } else {
      setFormError(result.error?.message ?? 'Gagal membuat surat peringatan.');
    }
  }

  async function handleAcknowledge(id: string) {
    const result = await acknowledgeDisciplinaryActionAction({ disciplinaryId: id });
    if (result.ok) {
      handleFilter();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader 
            title={<>{t('title')}</>}
            description={<>{t('subtitle')}</>}
            actions={<>
          <button
                    onClick={() => setShowForm(!showForm)}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-ember-5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ember-6"
                  >
                    {showForm ? tc('labels.cancel') : t('create')}
                  </button>
            </>}
          />

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl border border-brand-cream-3 bg-card p-6">
          <h2 className="mb-4 text-base font-semibold text-brand-ink">
            {t('createNew')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-ink-2">
                  {tc('employee')} *
                </label>
                <Select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none"
                >
                  <option value="">{t('selectEmployee')}</option>
                  {employees.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-ink-2">
                  {t('level')} *
                </label>
                <Select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as 'SP1' | 'SP2' | 'SP3')}
                  className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none"
                >
                  <option value="SP1">{t('sp1Desc')}</option>
                  <option value="SP2">{t('sp2Desc')}</option>
                  <option value="SP3">{t('sp3Desc')}</option>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-ink-2">
                  {t('incidentDate')} *
                </label>
                <Input
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none"
                />
              </div>
              <FileUploadField
                label={t('attachment')}
                hiddenName="attachmentUrl"
                value={attachmentUrl}
                area="disciplinary"
                visibility="private"
                onChange={(url) => setAttachmentUrl(url)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink-2">{t('reason')} *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('reasonPlaceholder')}
                rows={3}
                required
                className="w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-ember-5 focus:outline-none"
              />
            </div>

            {formError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="rounded-lg border border-brand-jade/30 bg-brand-jade/10 px-4 py-3 text-sm text-brand-jade">
                {formSuccess}
              </div>
            )}

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-ember-5 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-ember-6"
            >
              {t('publish')}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink"
        >
          <option value="">{t('allLevels')}</option>
          <option value="SP1">SP1</option>
          <option value="SP2">SP2</option>
          <option value="SP3">SP3</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink"
        >
          <option value="">{t('allStatus')}</option>
          <option value="issued">Diterbitkan</option>
          <option value="acknowledged">Ditekankan</option>
          <option value="escalated">Dieselakan</option>
        </select>
        <Button
          onClick={handleFilter}
          disabled={isPending}
          className="rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm text-brand-ink hover:bg-brand-cream-1 disabled:opacity-50" variant="secondary" size="md"
        >
          {isPending ? tc('actions.loading') : t('filterBtn')}
        </Button>
      </div>

      {/* List */}
      {actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-brand-cream-3 bg-card py-12 text-center">
          <p className="text-sm text-brand-ink-3">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => {
            const lvl = LEVEL_LABEL[action.level] ?? {
              short: 'SP1',
              color: 'bg-brand-gold/10 text-brand-gold',
              desc: '',
            };
            const status = STATUS_LABEL[action.status] ?? {
              label: 'issued',
              color: 'bg-brand-gold/10 text-brand-gold',
            };
            return (
              <div key={action.id} className="rounded-xl border border-brand-cream-3 bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${lvl.color}`}
                      >
                        {lvl.short}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-brand-ink">
                      {lvl.desc}
                      {action.employeeName ? ` — ${action.employeeName}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-brand-ink-3">{action.reason}</p>
                    <p className="mt-1.5 text-xs text-brand-ink-3">
                      Insiden: {formatDate(action.incidentDate)}
                      {action.issuedByName ? ` · Diterbitkan oleh ${action.issuedByName}` : ''}
                    </p>
                    {action.attachmentUrl && (
                      <a
                        href={action.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-block text-xs text-brand-ember-5 hover:text-brand-ember-6"
                      >
                        Lampiran
                      </a>
                    )}
                  </div>
                  {action.status === 'issued' && (
                    <button
                      onClick={() => handleAcknowledge(action.id)}
                      className="shrink-0 rounded-lg border border-brand-cream-3 px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-cream-1"
                    >
                      Teken
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
