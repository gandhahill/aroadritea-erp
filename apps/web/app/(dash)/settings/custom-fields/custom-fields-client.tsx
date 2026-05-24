'use client';

/**
 * Custom Fields Client — SD §17.3
 *
 * Entity type selector + field list table + create/edit modal.
 * Uses optimistic updates for better UX.
 */

import type { DataType } from '@erp/services/customfield';
import type { AuditContext } from '@erp/shared/types';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type { CustomFieldItem } from './actions';
import {
  serverCreateCustomField,
  serverDeleteCustomField,
  serverUpdateCustomField,
} from './actions';
import { Button, Input, Select, TableCell, TableBody, TableHead, Table } from "@erp/ui";
import { PageHeader } from "@/components/page-header";

const ENTITY_TYPE_KEYS = [
  'product',
  'partner',
  'employee',
  'purchase_order',
  'sales_order',
  'journal_entry',
] as const;

const DATA_TYPES = ['string', 'number', 'boolean', 'date', 'enum', 'reference'] as const;

interface Props {
  initialFields: CustomFieldItem[];
  ctx: AuditContext;
}

interface FormState {
  key: string;
  name_id: string;
  name_en: string;
  name_zh: string;
  dataType: string;
  enumOptions: string; // comma-separated for 'enum' type
  isRequired: boolean;
  validationRegex: string;
  displayOrder: number;
}

const EMPTY_FORM: FormState = {
  key: '',
  name_id: '',
  name_en: '',
  name_zh: '',
  dataType: 'string',
  enumOptions: '',
  isRequired: false,
  validationRegex: '',
  displayOrder: 0,
};

export function CustomFieldsClient({ initialFields, ctx }: Props) {
  const t = useTranslations('settings.customFields');
  const tc = useTranslations('common');
  const tDT = useTranslations('settings.customFields.dataTypes');
  const tET = useTranslations('settings.customFields.entityTypes');

  const [fields, setFields] = useState<CustomFieldItem[]>(initialFields);
  const [selectedEntity, setSelectedEntity] = useState<string>('product');
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredFields = fields.filter((f) => f.entityType === selectedEntity);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  }

  function openEdit(field: CustomFieldItem) {
    setEditingId(field.id);
    setForm({
      key: field.key,
      name_id: (field.name as Record<string, string>)?.id ?? '',
      name_en: (field.name as Record<string, string>)?.en ?? '',
      name_zh: (field.name as Record<string, string>)?.zh ?? '',
      dataType: field.dataType,
      enumOptions: Array.isArray(field.enumOptions)
        ? field.enumOptions.map((o) => o.value).join(', ')
        : '',
      isRequired: field.isRequired,
      validationRegex: field.validationRegex ?? '',
      displayOrder: field.displayOrder,
    });
    setFormError(null);
    setShowModal(true);
  }

  function handleFormChange(field: keyof FormState, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const name: Record<string, string> = {
      id: form.name_id,
      en: form.name_en || form.name_id,
      zh: form.name_zh || form.name_id,
    };

    let enumOptions: Array<{ value: string; label: string }> | undefined;
    if (form.dataType === 'enum' && form.enumOptions.trim()) {
      enumOptions = form.enumOptions.split(',').map((v) => ({
        value: v.trim(),
        label: v.trim(),
      }));
    }

    startTransition(async () => {
      if (editingId) {
        // Update
        const result = await serverUpdateCustomField(
          {
            id: editingId,
            name,
            enumOptions,
            isRequired: form.isRequired,
            validationRegex: form.validationRegex || undefined,
            displayOrder: form.displayOrder,
          },
          ctx,
        );
        if (!result.success) {
          setFormError(result.error ?? 'Update failed');
          return;
        }
        // Optimistic update
        setFields((prev) =>
          prev.map((f) =>
            f.id === editingId
              ? {
                  ...f,
                  name,
                  enumOptions: enumOptions ?? f.enumOptions,
                  isRequired: form.isRequired,
                  validationRegex: form.validationRegex || null,
                  displayOrder: form.displayOrder,
                }
              : f,
          ),
        );
      } else {
        // Create
        const result = await serverCreateCustomField(
          {
            entityType: selectedEntity,
            key: form.key,
            name,
            dataType: form.dataType as DataType,
            enumOptions,
            isRequired: form.isRequired,
            validationRegex: form.validationRegex || undefined,
            displayOrder: form.displayOrder,
          },
          ctx,
        );
        if (!result.success) {
          setFormError(result.error ?? 'Create failed');
          return;
        }
        // Add to list optimistically (will refresh on page reload)
        const newField: CustomFieldItem = {
          id: result.id!,
          entityType: selectedEntity,
          key: form.key,
          name,
          dataType: form.dataType,
          enumOptions: enumOptions ?? null,
          refEntityType: null,
          isRequired: form.isRequired,
          validationRegex: form.validationRegex || null,
          isIndexed: false,
          displayOrder: form.displayOrder,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setFields((prev) => [...prev, newField]);
      }
      closeModal();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await serverDeleteCustomField(id, ctx);
      if (!result.success) return;
      setFields((prev) => prev.filter((f) => f.id !== id));
      setConfirmDeleteId(null);
    });
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader 
            title={<>{t('title')}</>}
            description={<>{t('subtitle')}</>}
            actions={<>
          <Button
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-red/90" variant="primary" size="md"
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
                    {t('createField')}
                  </Button>
            </>}
          />

      {/* Entity type tabs */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-brand-cream-3 pb-px">
        {ENTITY_TYPE_KEYS.map((etKey) => (
          <Button
            key={etKey}
            onClick={() => setSelectedEntity(etKey)}
            className={`flex-shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedEntity === etKey
                ? 'border-b-2 border-brand-red bg-brand-red/5 text-brand-red'
                : 'text-brand-ink-2 hover:bg-brand-cream-2 hover:text-brand-ink'
            }`} variant="primary" size="md"
          >
            {tET(etKey)}
          </Button>
        ))}
      </div>

      {/* Field list */}
      {filteredFields.length === 0 ? (
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
            {t('createField')}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-brand-cream-3">
          <Table className="min-w-full divide-y divide-brand-cream-3">
            <thead className="bg-brand-cream-2">
              <tr>
                <TableHead className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                  {t('fieldKey')}
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                  {t('fieldName')}
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                  {t('dataType')}
                </TableHead>
                <TableHead className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                  {t('required')}
                </TableHead>
                <TableHead className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                  {t('displayOrder')}
                </TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                  Actions
                </TableHead>
              </tr>
            </thead>
            <TableBody>
              {filteredFields.map((field) => {
                const nameObj = field.name as Record<string, string>;
                return (
                  <tr key={field.id} className="hover:bg-brand-cream-2/50">
                    <TableCell className="px-4 py-3">
                      <code className="rounded bg-brand-cream-2 px-2 py-0.5 text-xs font-mono text-brand-ink">
                        {field.key}
                      </code>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="text-sm font-medium text-brand-ink">
                        {nameObj.id || nameObj.en || Object.values(nameObj)[0] || '—'}
                      </div>
                      {nameObj.en && nameObj.id !== nameObj.en && (
                        <div className="text-xs text-brand-ink-3">{nameObj.en}</div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-brand-cream-2 px-2.5 py-0.5 text-xs font-medium text-brand-ink-2">
                        {tDT(`dataTypes.${field.dataType}` as 'dataTypes.string')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      {field.isRequired ? (
                        <svg
                          className="mx-auto h-4 w-4 text-brand-jade"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="mx-auto h-4 w-4 text-brand-cream-3"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center text-sm text-brand-ink-2">
                      {field.displayOrder}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(field)}
                          className="rounded p-1.5 text-brand-ink-2 hover:bg-brand-cream-2 hover:text-brand-red"
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
                          onClick={() => setConfirmDeleteId(field.id)}
                          className="rounded p-1.5 text-brand-ink-3 hover:bg-red-50 hover:text-red-500"
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
                    </TableCell>
                  </tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-brand-cream-3 bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-brand-ink">
                {editingId ? t('editField') : t('createField')}
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

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Key (only on create) */}
              {!editingId && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-brand-ink">
                    {t('fieldKey')} <span className="text-brand-red">*</span>
                  </label>
                  <Input
                    type="text"
                    value={form.key}
                    onChange={(e) => handleFormChange('key', e.target.value)}
                    placeholder="e.g. color_code"
                    pattern="[a-z][a-z0-9_]*"
                    maxLength={32}
                    required
                    className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink placeholder-brand-cream-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                  <p className="mt-1 text-xs text-brand-ink-3">
                    {t('keyHint')}
                  </p>
                </div>
              )}

              {/* Names */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-brand-ink">
                    {t('nameId')} <span className="text-brand-red">*</span>
                  </label>
                  <Input
                    type="text"
                    value={form.name_id}
                    onChange={(e) => handleFormChange('name_id', e.target.value)}
                    required
                    className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink placeholder-brand-cream-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-brand-ink">{t('nameEn')}</label>
                  <Input
                    type="text"
                    value={form.name_en}
                    onChange={(e) => handleFormChange('name_en', e.target.value)}
                    className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink placeholder-brand-cream-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-brand-ink">{t('nameZh')}</label>
                  <Input
                    type="text"
                    value={form.name_zh}
                    onChange={(e) => handleFormChange('name_zh', e.target.value)}
                    className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink placeholder-brand-cream-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>
              </div>

              {/* Data type */}
              <div>
                <label className="mb-1 block text-sm font-medium text-brand-ink">
                  {t('dataType')} <span className="text-brand-red">*</span>
                </label>
                <Select
                  value={form.dataType}
                  onChange={(e) => handleFormChange('dataType', e.target.value)}
                  disabled={!!editingId}
                  className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {DATA_TYPES.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Enum options */}
              {form.dataType === 'enum' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-brand-ink">
                    {t('enumOptions')}
                  </label>
                  <Input
                    type="text"
                    value={form.enumOptions}
                    onChange={(e) => handleFormChange('enumOptions', e.target.value)}
                    placeholder="option1, option2, option3"
                    className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink placeholder-brand-cream-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                  <p className="mt-1 text-xs text-brand-ink-3">{t('enumHint')}</p>
                </div>
              )}

              {/* Validation regex */}
              <div>
                <label className="mb-1 block text-sm font-medium text-brand-ink">
                  {t('validationRegex')}
                </label>
                <Input
                  type="text"
                  value={form.validationRegex}
                  onChange={(e) => handleFormChange('validationRegex', e.target.value)}
                  placeholder="e.g. ^[A-Z0-9]{5}$"
                  className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink placeholder-brand-cream-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>

              {/* Required + Order */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-brand-ink">
                  <input
                    type="checkbox"
                    checked={form.isRequired}
                    onChange={(e) => handleFormChange('isRequired', e.target.checked)}
                    className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
                  />
                  {t('required')}
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-brand-ink">{t('displayOrder')}</label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={(e) =>
                      handleFormChange('displayOrder', Number.parseInt(e.target.value) || 0)
                    }
                    min={0}
                    className="w-20 rounded-lg border border-brand-cream-3 px-2 py-1 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>
              </div>

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {formError}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-brand-cream-3 px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-cream-2"
                >
                  {tc('actions.cancel')}
                </button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red/90 disabled:opacity-50" variant="primary" size="md"
                >
                  {isPending ? tc('actions.saving') : tc('actions.save')}
                </Button>
              </div>
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
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-brand-ink">{t('deleteField')}</h3>
                <p className="text-sm text-brand-ink-3">
                  {t('confirmDelete', {
                    name: filteredFields.find((f) => f.id === confirmDeleteId)?.key ?? '',
                  })}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg border border-brand-cream-3 px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-cream-2"
              >
                {tc('actions.cancel')}
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={isPending}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {tc('actions.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
