'use client';

/**
 * Workflow Editor Client — SD §18
 *
 * List workflow definitions + create/edit modal.
 * Condition builder: field / operator / value rows.
 * Steps builder: ordered list of approver roles.
 * JSON preview tab.
 */

import type { AuditContext } from '@erp/shared/types';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type { ConditionInput, WorkflowDefinitionItem, WorkflowStepInput } from './actions';
import {
  serverCreateWorkflowDefinition,
  serverDeleteWorkflowDefinition,
  serverUpdateWorkflowDefinition,
} from './actions';

const ENTITY_TYPES = [
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'leave_request', label: 'Leave Request' },
  { value: 'stock_adjustment', label: 'Stock Adjustment' },
  { value: 'reimbursement_request', label: 'Reimbursement' },
  { value: 'journal_entry', label: 'Journal Entry' },
] as const;

const OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'ne', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'in', label: 'in' },
  { value: 'contains', label: 'contains' },
] as const;

const APPROVER_ROLES = ['store_manager', 'director', 'owner', 'hr_manager', 'finance'] as const;

/**
 * Fields available per entity type. Switching the condition row's field
 * from free-text to a dropdown stops users typing typos like "grandtotal"
 * when the service expects camelCase `grandTotal`. Add new fields here
 * once the corresponding service exposes them in the workflow evaluator.
 */
const FIELD_BY_ENTITY: Record<string, Array<{ value: string; label: string }>> = {
  purchase_order: [
    { value: 'grandTotal', label: 'Grand total (Rp)' },
    { value: 'subtotal', label: 'Subtotal (Rp)' },
    { value: 'supplierId', label: 'Supplier ID' },
    { value: 'locationId', label: 'Location ID' },
  ],
  leave_request: [
    { value: 'dayCount', label: 'Jumlah hari' },
    { value: 'leaveTypeCode', label: 'Tipe cuti (kode)' },
    { value: 'employeeId', label: 'Employee ID' },
  ],
  stock_adjustment: [
    { value: 'reason', label: 'Alasan (waste/damage/...)' },
    { value: 'locationId', label: 'Location ID' },
    { value: 'lineCount', label: 'Jumlah baris' },
  ],
  reimbursement_request: [
    { value: 'amount', label: 'Nominal (Rp)' },
    { value: 'categoryCode', label: 'Kategori (kode)' },
    { value: 'employeeId', label: 'Employee ID' },
  ],
  journal_entry: [
    { value: 'totalDebit', label: 'Total debit (Rp)' },
    { value: 'postingDate', label: 'Tanggal posting' },
    { value: 'locationId', label: 'Location ID' },
  ],
};

interface Props {
  initialDefinitions: WorkflowDefinitionItem[];
  ctx: AuditContext;
}

// ─── Form types ────────────────────────────────────────────────────────────────

interface StepForm {
  stepOrder: number;
  approverRole: string;
}

interface ConditionForm {
  field: string;
  op: string;
  value: string;
}

interface FormState {
  name_id: string;
  name_en: string;
  name_zh: string;
  description: string;
  entityType: string;
  priority: number;
  conditions: ConditionForm[];
  steps: StepForm[];
}

const EMPTY_FORM: FormState = {
  name_id: '',
  name_en: '',
  name_zh: '',
  description: '',
  entityType: 'purchase_order',
  priority: 0,
  conditions: [],
  steps: [{ stepOrder: 1, approverRole: 'store_manager' }],
};

function buildJsonPreview(form: FormState): string {
  const obj = {
    name: { id: form.name_id, en: form.name_en || form.name_id, zh: form.name_zh || form.name_id },
    description: form.description || null,
    entityType: form.entityType,
    isActive: true,
    priority: form.priority,
    conditionJson:
      form.conditions.length > 0
        ? form.conditions.map((c) => ({
            field: c.field,
            op: c.op,
            value: isNaN(Number(c.value)) ? c.value : Number(c.value),
          }))
        : null,
    stepsJson: form.steps.map((s) => ({
      stepOrder: s.stepOrder,
      approverRole: s.approverRole,
    })),
  };
  return JSON.stringify(obj, null, 2);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WorkflowEditorClient({ initialDefinitions, ctx }: Props) {
  const t = useTranslations('workflow');
  const tc = useTranslations('common');

  const [definitions, setDefinitions] = useState<WorkflowDefinitionItem[]>(initialDefinitions);
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');
  const [jsonPreview, setJsonPreview] = useState('{}');

  // ── Open create / edit ──────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setActiveTab('form');
    setJsonPreview(buildJsonPreview(EMPTY_FORM));
    setShowModal(true);
  }

  function openEdit(def: WorkflowDefinitionItem) {
    const steps: StepForm[] = (def.stepsJson ?? []).map((s) => ({
      stepOrder: s.stepOrder,
      approverRole: s.approverRole,
    }));
    if (steps.length === 0) steps.push({ stepOrder: 1, approverRole: 'store_manager' });

    const conditions: ConditionForm[] = (def.conditionJson ?? []).map((c) => ({
      field: c.field,
      op: c.op,
      value: String(c.value),
    }));

    const f: FormState = {
      name_id: (def.name as Record<string, string>)?.id ?? '',
      name_en: (def.name as Record<string, string>)?.en ?? '',
      name_zh: (def.name as Record<string, string>)?.zh ?? '',
      description: def.description ?? '',
      entityType: def.entityType,
      priority: def.priority,
      conditions,
      steps,
    };

    setEditingId(def.id);
    setForm(f);
    setFormError(null);
    setActiveTab('form');
    setJsonPreview(buildJsonPreview(f));
    setShowModal(true);
  }

  function updateForm(updater: (prev: FormState) => FormState) {
    setForm((prev) => {
      const next = updater(prev);
      setJsonPreview(buildJsonPreview(next));
      return next;
    });
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setFormError(null);
  }

  // ── Steps helpers ────────────────────────────────────────────────────────────

  function addStep() {
    updateForm((prev) => ({
      ...prev,
      steps: [...prev.steps, { stepOrder: prev.steps.length + 1, approverRole: 'store_manager' }],
    }));
  }

  function removeStep(index: number) {
    updateForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepOrder: i + 1 })),
    }));
  }

  function updateStep(index: number, role: string) {
    updateForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? { ...s, approverRole: role } : s)),
    }));
  }

  // ── Conditions helpers ───────────────────────────────────────────────────────

  function addCondition() {
    updateForm((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { field: '', op: 'eq', value: '' }],
    }));
  }

  function removeCondition(index: number) {
    updateForm((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  }

  function updateCondition(index: number, patch: Partial<ConditionForm>) {
    updateForm((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const name: Record<string, string> = {
      id: form.name_id,
      en: form.name_en || form.name_id,
      zh: form.name_zh || form.name_id,
    };

    const conditionJson: ConditionInput[] = form.conditions
      .filter((c) => c.field.trim())
      .map((c) => ({
        field: c.field,
        op: c.op,
        value: isNaN(Number(c.value)) ? c.value : Number(c.value),
      }));

    const stepsJson: WorkflowStepInput[] = form.steps.map((s, i) => ({
      stepOrder: i + 1,
      approverRole: s.approverRole,
    }));

    startTransition(async () => {
      if (editingId) {
        const result = await serverUpdateWorkflowDefinition(
          {
            id: editingId,
            name,
            description: form.description || undefined,
            isActive: true,
            priority: form.priority,
            conditionJson: conditionJson.length > 0 ? conditionJson : undefined,
            stepsJson,
          },
          ctx,
        );
        if (!result.success) {
          setFormError(result.error ?? 'Update failed');
          return;
        }
        setDefinitions((prev) =>
          prev.map((d) =>
            d.id === editingId
              ? {
                  ...d,
                  name,
                  description: form.description || null,
                  priority: form.priority,
                  conditionJson: conditionJson.length > 0 ? (conditionJson as never) : null,
                  stepsJson: stepsJson as never,
                }
              : d,
          ),
        );
      } else {
        const result = await serverCreateWorkflowDefinition(
          {
            name,
            description: form.description,
            entityType: form.entityType,
            priority: form.priority,
            conditionJson: conditionJson.length > 0 ? conditionJson : undefined,
            stepsJson,
          },
          ctx,
        );
        if (!result.success) {
          setFormError(result.error ?? 'Create failed');
          return;
        }
        const newDef: WorkflowDefinitionItem = {
          id: result.id!,
          name,
          description: form.description || null,
          entityType: form.entityType,
          isActive: true,
          priority: form.priority,
          conditionJson: conditionJson.length > 0 ? (conditionJson as never) : null,
          stepsJson: stepsJson as never,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setDefinitions((prev) => [newDef, ...prev]);
      }
      closeModal();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await serverDeleteWorkflowDefinition(id, ctx);
      if (!result.success) return;
      setDefinitions((prev) => prev.filter((d) => d.id !== id));
      setConfirmDeleteId(null);
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
          <p className="mt-1 text-sm text-brand-ink-3">{t('subtitle')}</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-red/90"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('createDefinition')}
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-brand-gold/20 bg-brand-gold/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-gold"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-brand-ink">{t('howItWorks')}</p>
            <p className="mt-0.5 text-xs text-brand-ink-2">{t('howItWorksDesc')}</p>
          </div>
        </div>
      </div>

      {/* Definitions list */}
      {definitions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-brand-cream-3 py-16 text-center">
          <svg
            className="mx-auto h-10 w-10 text-brand-ink-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-2.15 1.586a2.251 2.251 0 00-1.028-.961A2.25 2.25 0 0014.25 2.25H12a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h.5"
            />
          </svg>
          <p className="mt-3 text-sm text-brand-ink-3">{t('empty')}</p>
          <button
            onClick={openCreate}
            className="mt-4 text-sm font-medium text-brand-red hover:underline"
          >
            {t('createDefinition')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {definitions.map((def) => {
            const nameObj = def.name as Record<string, string>;
            const stepCount = (def.stepsJson ?? []).length;
            return (
              <div
                key={def.id}
                className="rounded-lg border border-brand-cream-3 bg-card p-4 hover:border-brand-red/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-brand-ink truncate">
                        {nameObj.id || nameObj.en || Object.values(nameObj)[0] || def.entityType}
                      </h3>
                      {!def.isActive && (
                        <span className="rounded-full bg-brand-cream-2 px-2 py-0.5 text-xs text-brand-ink-3">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-brand-ink-3 truncate">
                      {def.description || '—'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-brand-ink-2">
                      <span className="rounded bg-brand-cream-2 px-2 py-0.5 font-mono">
                        {def.entityType}
                      </span>
                      <span className="text-brand-ink-3">Priority: {def.priority}</span>
                      <span className="text-brand-ink-3">Steps: {stepCount}</span>
                      {(def.conditionJson ?? []).length > 0 && (
                        <span className="text-brand-ink-3">
                          Conditions: {def.conditionJson!.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => openEdit(def)}
                      className="rounded p-2 text-brand-ink-2 hover:bg-brand-cream-2 hover:text-brand-red"
                      title="Edit"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(def.id)}
                      className="rounded p-2 text-brand-ink-3 hover:bg-red-50 hover:text-red-500"
                      title="Delete"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm py-8">
          <div className="w-full max-w-2xl rounded-xl border border-brand-cream-3 bg-card shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-brand-cream-3 px-6 py-4">
              <h2 className="text-lg font-semibold text-brand-ink">
                {editingId ? t('editDefinition') : t('createDefinition')}
              </h2>
              <button onClick={closeModal} className="text-brand-ink-3 hover:text-brand-ink">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-brand-cream-3 px-6">
              <button
                onClick={() => setActiveTab('form')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'form'
                    ? 'border-brand-red text-brand-red'
                    : 'border-transparent text-brand-ink-2 hover:text-brand-ink'
                }`}
              >
                {t('formTab')}
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'json'
                    ? 'border-brand-red text-brand-red'
                    : 'border-transparent text-brand-ink-2 hover:text-brand-ink'
                }`}
              >
                {t('jsonTab')}
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {activeTab === 'form' ? (
                <div className="space-y-5 px-6 py-5">
                  {/* Names */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-brand-ink">
                        Nama (ID) <span className="text-brand-red">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.name_id}
                        onChange={(e) => updateForm((p) => ({ ...p, name_id: e.target.value }))}
                        required
                        className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-brand-ink">
                        Name (EN)
                      </label>
                      <input
                        type="text"
                        value={form.name_en}
                        onChange={(e) => updateForm((p) => ({ ...p, name_en: e.target.value }))}
                        className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-brand-ink">
                        名称 (ZH)
                      </label>
                      <input
                        type="text"
                        value={form.name_zh}
                        onChange={(e) => updateForm((p) => ({ ...p, name_zh: e.target.value }))}
                        className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                      />
                    </div>
                  </div>

                  {/* Entity type + priority */}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="mb-1 block text-sm font-medium text-brand-ink">
                        {t('entityType')} <span className="text-brand-red">*</span>
                      </label>
                      <select
                        value={form.entityType}
                        onChange={(e) => {
                          if (!editingId) updateForm((p) => ({ ...p, entityType: e.target.value }));
                        }}
                        disabled={!!editingId}
                        className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {ENTITY_TYPES.map((et) => (
                          <option key={et.value} value={et.value}>
                            {et.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-28">
                      <label className="mb-1 block text-sm font-medium text-brand-ink">
                        {t('priority')}
                      </label>
                      <input
                        type="number"
                        value={form.priority}
                        onChange={(e) =>
                          updateForm((p) => ({
                            ...p,
                            priority: Number.parseInt(e.target.value) || 0,
                          }))
                        }
                        className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-brand-ink">
                      {t('description')}
                    </label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => updateForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                  </div>

                  {/* Conditions */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-brand-ink">
                        {t('conditions')}
                      </label>
                      <button
                        type="button"
                        onClick={addCondition}
                        className="text-xs font-medium text-brand-red hover:underline"
                      >
                        + {t('addCondition')}
                      </button>
                    </div>
                    {form.conditions.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-brand-cream-3 py-3 text-center text-xs text-brand-ink-3">
                        {t('noConditions')} — workflow applies to all {form.entityType}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {form.conditions.map((cond, idx) => {
                          const entityFields = FIELD_BY_ENTITY[form.entityType] ?? [];
                          // When the chosen entity exposes a known field
                          // list, drive the field input as a dropdown so
                          // users can't accidentally type typos. If the
                          // entity isn't in the map yet (or the saved
                          // condition predates it), fall through to a free-
                          // text input so legacy rules stay editable.
                          const fieldInKnownList = entityFields.some((f) => f.value === cond.field);
                          const showDropdown =
                            entityFields.length > 0 && (cond.field === '' || fieldInKnownList);
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              {showDropdown ? (
                                <select
                                  value={cond.field}
                                  onChange={(e) => updateCondition(idx, { field: e.target.value })}
                                  className="flex-1 rounded-lg border border-brand-cream-3 px-3 py-1.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                                >
                                  <option value="">— pilih field —</option>
                                  {entityFields.map((f) => (
                                    <option key={f.value} value={f.value}>
                                      {f.label} ({f.value})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={cond.field}
                                  placeholder="field (e.g. grandTotal)"
                                  onChange={(e) => updateCondition(idx, { field: e.target.value })}
                                  className="flex-1 rounded-lg border border-brand-cream-3 px-3 py-1.5 text-sm text-brand-ink placeholder-brand-cream-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                                />
                              )}
                              <select
                                value={cond.op}
                                onChange={(e) => updateCondition(idx, { op: e.target.value })}
                                className="w-20 rounded-lg border border-brand-cream-3 px-2 py-1.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                              >
                                {OPERATORS.map((op) => (
                                  <option key={op.value} value={op.value}>
                                    {op.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={cond.value}
                                placeholder="value"
                                onChange={(e) => updateCondition(idx, { value: e.target.value })}
                                className="flex-1 rounded-lg border border-brand-cream-3 px-3 py-1.5 text-sm text-brand-ink placeholder-brand-cream-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                              />
                              <button
                                type="button"
                                onClick={() => removeCondition(idx)}
                                className="rounded p-1 text-brand-ink-3 hover:bg-red-50 hover:text-red-500"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Steps */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-brand-ink">{t('steps')}</label>
                      <button
                        type="button"
                        onClick={addStep}
                        className="text-xs font-medium text-brand-red hover:underline"
                      >
                        + {t('addStep')}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {form.steps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-red/10 text-xs font-bold text-brand-red">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-brand-ink-2">Approver role:</span>
                          <select
                            value={step.approverRole}
                            onChange={(e) => updateStep(idx, e.target.value)}
                            className="flex-1 rounded-lg border border-brand-cream-3 px-3 py-1.5 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                          >
                            {APPROVER_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          {form.steps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeStep(idx)}
                              className="rounded p-1 text-brand-ink-3 hover:bg-red-50 hover:text-red-500"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {formError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {formError}
                    </div>
                  )}

                  {/* Modal actions */}
                  <div className="flex justify-end gap-3 border-t border-brand-cream-3 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-lg border border-brand-cream-3 px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-cream-2"
                    >
                      {tc('labels.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red/90 disabled:opacity-50"
                    >
                      {isPending ? '...' : tc('labels.save')}
                    </button>
                  </div>
                </div>
              ) : (
                /* JSON preview tab */
                <div className="px-6 py-5">
                  <pre className="max-h-96 overflow-auto rounded-lg border border-brand-cream-3 bg-brand-cream-2 p-4 text-xs font-mono text-brand-ink whitespace-pre">
                    {jsonPreview}
                  </pre>
                  <div className="mt-4 flex justify-end gap-3 border-t border-brand-cream-3 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-lg border border-brand-cream-3 px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-cream-2"
                    >
                      {tc('labels.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-brand-cream-3 bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <svg
                  className="h-5 w-5 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-brand-ink">{t('deleteDefinition')}</h3>
                <p className="mt-1 text-sm text-brand-ink-3">{t('confirmDelete')}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg border border-brand-cream-3 px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-cream-2"
              >
                {tc('labels.cancel')}
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={isPending}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {tc('labels.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
