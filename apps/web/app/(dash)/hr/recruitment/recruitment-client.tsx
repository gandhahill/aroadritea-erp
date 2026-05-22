'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  type ApplicantRow,
  type OpeningRow,
  createApplicantAction,
  createOpeningAction,
  deleteApplicantAction,
  setApplicantStageAction,
  updateApplicantAction,
  updateOpeningStatusAction,
} from './actions';
import { useTranslations } from 'next-intl';

const STAGES: Array<
  'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn'
> = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'];

const STAGE_LABEL: Record<string, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const STAGE_COLOR: Record<string, string> = {
  applied: 'bg-brand-cream-2 text-brand-ink-2',
  screening: 'bg-brand-gold/10 text-brand-gold',
  interview: 'bg-brand-jade/10 text-brand-jade',
  offer: 'bg-brand-red/10 text-brand-red',
  hired: 'bg-brand-jade text-white',
  rejected: 'bg-rose-50 text-rose-600',
  withdrawn: 'bg-brand-ink/10 text-brand-ink-3',
};

interface Props {
  initialOpenings: OpeningRow[];
  initialApplicants: ApplicantRow[];
  canManage: boolean;
}

const INPUT =
  'w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20';

export function RecruitmentClient({ initialOpenings, initialApplicants, canManage }: Props) {
  const t = useTranslations('hr.recruitment');
  const [openings, setOpenings] = useState(initialOpenings);
  const [applicants, setApplicants] = useState(initialApplicants);
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [showNewOpening, setShowNewOpening] = useState(false);
  const [newOpening, setNewOpening] = useState({
    title: '',
    department: '',
    summary: '',
    requirements: '',
    headcount: 1,
    status: 'open' as 'draft' | 'open' | 'closed',
  });

  const [showNewApplicant, setShowNewApplicant] = useState<string | null>(null);
  const [newApplicant, setNewApplicant] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
  });

  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [openingFilter, setOpeningFilter] = useState<string | null>(null);
  const [applicantPage, setApplicantPage] = useState(1);

  const filteredApplicants = useMemo(() => {
    return applicants.filter(
      (a) =>
        (!stageFilter || a.stage === stageFilter) &&
        (!openingFilter || a.openingId === openingFilter),
    );
  }, [applicants, stageFilter, openingFilter]);
  const applicantPageSize = 25;
  const applicantTotalPages = Math.max(1, Math.ceil(filteredApplicants.length / applicantPageSize));
  const visibleApplicants = filteredApplicants.slice(
    (Math.min(applicantPage, applicantTotalPages) - 1) * applicantPageSize,
    Math.min(applicantPage, applicantTotalPages) * applicantPageSize,
  );

  function submitOpening() {
    setErr(null);
    startTransition(async () => {
      const res = await createOpeningAction(newOpening);
      if (!res.ok || !res.id) {
        setErr(res.error ?? 'Gagal menyimpan lowongan.');
        return;
      }
      setOpenings((prev) => [
        {
          id: res.id!,
          title: newOpening.title,
          department: newOpening.department || null,
          status: newOpening.status,
          headcount: newOpening.headcount,
          openDate: null,
          closeDate: null,
          applicantCount: 0,
        },
        ...prev,
      ]);
      setNewOpening({
        title: '',
        department: '',
        summary: '',
        requirements: '',
        headcount: 1,
        status: 'open',
      });
      setShowNewOpening(false);
    });
  }

  function setOpeningStatus(openingId: string, status: 'draft' | 'open' | 'closed') {
    setErr(null);
    startTransition(async () => {
      const res = await updateOpeningStatusAction({ openingId, status });
      if (!res.ok) {
        setErr(res.error ?? 'Gagal update status.');
        return;
      }
      setOpenings((prev) => prev.map((o) => (o.id === openingId ? { ...o, status } : o)));
    });
  }

  function submitApplicant(openingId: string) {
    setErr(null);
    startTransition(async () => {
      const res = await createApplicantAction({ openingId, ...newApplicant });
      if (!res.ok || !res.id) {
        setErr(res.error ?? 'Gagal menyimpan kandidat.');
        return;
      }
      const opening = openings.find((o) => o.id === openingId);
      setApplicants((prev) => [
        {
          id: res.id!,
          openingId,
          openingTitle: opening?.title ?? '—',
          name: newApplicant.name,
          email: newApplicant.email || null,
          stage: 'applied',
          appliedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setOpenings((prev) =>
        prev.map((o) => (o.id === openingId ? { ...o, applicantCount: o.applicantCount + 1 } : o)),
      );
      setNewApplicant({ name: '', email: '', phone: '', notes: '' });
      setShowNewApplicant(null);
    });
  }

  function setStage(applicantId: string, stage: ApplicantRow['stage']) {
    setErr(null);
    startTransition(async () => {
      const res = await setApplicantStageAction({
        applicantId,
        stage: stage as
          | 'applied'
          | 'screening'
          | 'interview'
          | 'offer'
          | 'hired'
          | 'rejected'
          | 'withdrawn',
      });
      if (!res.ok) {
        setErr(res.error ?? 'Gagal update tahap.');
        return;
      }
      setApplicants((prev) => prev.map((a) => (a.id === applicantId ? { ...a, stage } : a)));
    });
  }

  // Edit / delete state — small inline editor without a modal to keep
  // the pipeline list in view while updating a candidate row.
  const [editingApplicantId, setEditingApplicantId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    resumeUrl: '',
    notes: '',
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function startEdit(a: ApplicantRow) {
    setEditingApplicantId(a.id);
    setEditForm({
      name: a.name,
      email: a.email ?? '',
      phone: '',
      resumeUrl: '',
      notes: '',
    });
  }

  function saveEdit() {
    if (!editingApplicantId) return;
    setErr(null);
    const id = editingApplicantId;
    startTransition(async () => {
      const res = await updateApplicantAction({
        applicantId: id,
        name: editForm.name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        resumeUrl: editForm.resumeUrl || null,
        notes: editForm.notes || null,
      });
      if (!res.ok) {
        setErr(res.error ?? 'Gagal menyimpan perubahan kandidat.');
        return;
      }
      setApplicants((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, name: editForm.name, email: editForm.email || null } : a,
        ),
      );
      setEditingApplicantId(null);
    });
  }

  function confirmDelete(applicantId: string) {
    setErr(null);
    startTransition(async () => {
      const res = await deleteApplicantAction({ applicantId });
      if (!res.ok) {
        setErr(res.error ?? 'Gagal menghapus kandidat.');
        return;
      }
      setApplicants((prev) => prev.filter((a) => a.id !== applicantId));
      setConfirmDeleteId(null);
    });
  }

  return (
    <div className="space-y-6">
      {err ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {err}
        </div>
      ) : null}

      <section className="rounded-xl border border-brand-cream-3 bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-brand-ink">{t('openings')}</h2>
          {canManage ? (
            <button
              type="button"
              onClick={() => setShowNewOpening((v) => !v)}
              className="rounded-md bg-brand-red px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-red-dark"
            >
              {showNewOpening ? t('cancel') : t('addOpening')}
            </button>
          ) : null}
        </div>

        {showNewOpening ? (
          <div className="mb-4 grid gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-3 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-ink-3">
                {t('titleField')}
              </span>
              <input
                value={newOpening.title}
                onChange={(e) => setNewOpening((p) => ({ ...p, title: e.target.value }))}
                placeholder={t('titlePlaceholder')}
                className={INPUT}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-ink-3">
                {t('departmentField')}
              </span>
              <input
                value={newOpening.department}
                onChange={(e) => setNewOpening((p) => ({ ...p, department: e.target.value }))}
                className={INPUT}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-ink-3">
                {t('headcountField')}
              </span>
              <input
                type="number"
                min={1}
                value={newOpening.headcount}
                onChange={(e) =>
                  setNewOpening((p) => ({ ...p, headcount: Number(e.target.value) }))
                }
                className={INPUT}
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-ink-3">
                {t('requirementsField')}
              </span>
              <textarea
                value={newOpening.requirements}
                onChange={(e) => setNewOpening((p) => ({ ...p, requirements: e.target.value }))}
                rows={3}
                className={INPUT}
              />
            </label>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="button"
                onClick={submitOpening}
                disabled={busy}
                className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
              >
                {busy ? t('saving') : t('saveOpening')}
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream-1 text-left text-xs uppercase tracking-wider text-brand-ink-3">
              <tr>
                <th className="px-3 py-2">{t('columns.title')}</th>
                <th className="px-3 py-2">{t('columns.department')}</th>
                <th className="px-3 py-2 text-center">{t('columns.applicants')}</th>
                <th className="px-3 py-2">{t('columns.status')}</th>
                <th className="px-3 py-2">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3">
              {openings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-brand-ink-3">
                    {t('emptyOpenings')}
                  </td>
                </tr>
              ) : (
                openings.map((o) => (
                  <tr key={o.id}>
                    <td className="px-3 py-2 font-medium text-brand-ink">{o.title}</td>
                    <td className="px-3 py-2 text-brand-ink-3">{o.department ?? '—'}</td>
                    <td className="px-3 py-2 text-center">{o.applicantCount}</td>
                    <td className="px-3 py-2">
                      {canManage ? (
                        <select
                          value={o.status}
                          onChange={(e) =>
                            setOpeningStatus(o.id, e.target.value as 'draft' | 'open' | 'closed')
                          }
                          className="rounded-md border border-brand-cream-3 bg-card px-2 py-1 text-xs"
                        >
                          <option value="draft">Draft</option>
                          <option value="open">Open</option>
                          <option value="closed">Closed</option>
                        </select>
                      ) : (
                        <span>{o.status}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => setShowNewApplicant((v) => (v === o.id ? null : o.id))}
                        className="rounded-md border border-brand-cream-3 px-2.5 py-1 text-xs font-semibold text-brand-ink-2 hover:border-brand-red/40 hover:text-brand-red disabled:opacity-40"
                      >
                        {t('addApplicant')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showNewApplicant ? (
          <div className="mt-3 grid gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-3 md:grid-cols-2">
            <p className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-brand-ink-3">
              {t('addApplicantTitle')}
              <span className="text-brand-ink">
                {openings.find((o) => o.id === showNewApplicant)?.title}
              </span>
            </p>
            <input
              placeholder={t('namePlaceholder')}
              value={newApplicant.name}
              onChange={(e) => setNewApplicant((p) => ({ ...p, name: e.target.value }))}
              className={INPUT}
            />
            <input
              placeholder={t('emailPlaceholder')}
              value={newApplicant.email}
              onChange={(e) => setNewApplicant((p) => ({ ...p, email: e.target.value }))}
              className={INPUT}
            />
            <input
              placeholder={t('phonePlaceholder')}
              value={newApplicant.phone}
              onChange={(e) => setNewApplicant((p) => ({ ...p, phone: e.target.value }))}
              className={INPUT}
            />
            <textarea
              placeholder={t('notesPlaceholder')}
              value={newApplicant.notes}
              onChange={(e) => setNewApplicant((p) => ({ ...p, notes: e.target.value }))}
              className={INPUT}
              rows={2}
            />
            <div className="md:col-span-2 flex justify-end">
              <button
                type="button"
                onClick={() => submitApplicant(showNewApplicant)}
                disabled={busy}
                className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
              >
                {busy ? t('saving') : t('saveApplicant')}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-brand-ink">{t('pipeline')}</h2>
          <div className="flex gap-2">
            <select
              value={openingFilter ?? ''}
              onChange={(e) => {
                setOpeningFilter(e.target.value || null);
                setApplicantPage(1);
              }}
              className="rounded-md border border-brand-cream-3 bg-card px-2 py-1 text-xs"
            >
              <option value="">{t('allOpenings')}</option>
              {openings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
            <select
              value={stageFilter ?? ''}
              onChange={(e) => {
                setStageFilter(e.target.value || null);
                setApplicantPage(1);
              }}
              className="rounded-md border border-brand-cream-3 bg-card px-2 py-1 text-xs"
            >
              <option value="">{t('allStages')}</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {t(`stages.${s}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream-1 text-left text-xs uppercase tracking-wider text-brand-ink-3">
              <tr>
                <th className="px-3 py-2">{t('applicantsColumns.name')}</th>
                <th className="px-3 py-2">{t('applicantsColumns.opening')}</th>
                <th className="px-3 py-2">{t('applicantsColumns.email')}</th>
                <th className="px-3 py-2">{t('applicantsColumns.applied')}</th>
                <th className="px-3 py-2">{t('applicantsColumns.stage')}</th>
                {canManage ? <th className="px-3 py-2 text-right">{t('applicantsColumns.actions')}</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3">
              {filteredApplicants.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 6 : 5}
                    className="px-3 py-6 text-center text-brand-ink-3"
                  >
                    {t('emptyApplicants')}
                  </td>
                </tr>
              ) : (
                visibleApplicants.map((a) => {
                  const isEditing = editingApplicantId === a.id;
                  return (
                    <tr key={a.id}>
                      <td className="px-3 py-2 font-medium text-brand-ink">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            className={INPUT}
                          />
                        ) : (
                          a.name
                        )}
                      </td>
                      <td className="px-3 py-2 text-brand-ink-3">{a.openingTitle}</td>
                      <td className="px-3 py-2 text-brand-ink-3">
                        {isEditing ? (
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                            className={INPUT}
                          />
                        ) : (
                          (a.email ?? '—')
                        )}
                      </td>
                      <td className="px-3 py-2 text-brand-ink-3">{a.appliedAt.slice(0, 10)}</td>
                      <td className="px-3 py-2">
                        {canManage ? (
                          <select
                            value={a.stage}
                            onChange={(e) =>
                              setStage(a.id, e.target.value as ApplicantRow['stage'])
                            }
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_COLOR[a.stage] ?? STAGE_COLOR.applied}`}
                          >
                            {STAGES.map((s) => (
                              <option key={s} value={s}>
                                {t(`stages.${s}`)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_COLOR[a.stage] ?? STAGE_COLOR.applied}`}
                          >
                            {t(`stages.${a.stage}`)}
                          </span>
                        )}
                      </td>
                      {canManage ? (
                        <td className="px-3 py-2 text-right">
                          {isEditing ? (
                            <span className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={saveEdit}
                                disabled={busy || !editForm.name.trim()}
                                className="rounded bg-brand-red px-2 py-1 text-xs font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
                              >
                                {t('save')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingApplicantId(null)}
                                className="rounded border border-brand-cream-3 px-2 py-1 text-xs font-semibold text-brand-ink-3 hover:bg-brand-cream-2"
                              >
                                {t('cancel')}
                              </button>
                            </span>
                          ) : confirmDeleteId === a.id ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="text-xs text-brand-ink-3">{t('confirmDelete')}</span>
                              <button
                                type="button"
                                onClick={() => confirmDelete(a.id)}
                                disabled={busy}
                                className="rounded bg-rose-500 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-600"
                              >
                                {t('yes')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded border border-brand-cream-3 px-2 py-1 text-xs font-semibold text-brand-ink-3 hover:bg-brand-cream-2"
                              >
                                {t('no')}
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => startEdit(a)}
                                className="text-xs text-brand-ink-2 hover:underline"
                              >
                                {t('edit')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(a.id)}
                                className="text-xs text-brand-red hover:underline"
                              >
                                {t('delete')}
                              </button>
                            </span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-col gap-3 border-t border-brand-cream-3 pt-3 text-xs text-brand-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {t('pagination', { count: filteredApplicants.length, page: Math.min(applicantPage, applicantTotalPages), total: applicantTotalPages })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={applicantPage <= 1}
              onClick={() => setApplicantPage((page) => Math.max(1, page - 1))}
              className="rounded-md border border-brand-cream-3 px-3 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-cream disabled:text-brand-ink-3 disabled:opacity-50"
            >
              {t('prev')}
            </button>
            <button
              type="button"
              disabled={applicantPage >= applicantTotalPages}
              onClick={() => setApplicantPage((page) => Math.min(applicantTotalPages, page + 1))}
              className="rounded-md border border-brand-cream-3 px-3 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-cream disabled:text-brand-ink-3 disabled:opacity-50"
            >
              {t('next')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
