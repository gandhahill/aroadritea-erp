'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import {
  type COAAccountDraft,
  type COANode,
  deleteCOAAccount,
  saveCOAAccount,
} from './actions';

interface Props {
  tree: COANode[];
}

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'cogs', 'expense'];
const NORMAL_BALANCES = ['debit', 'credit'];
const fieldClass =
  'w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none';

const blankDraft: COAAccountDraft = {
  code: '',
  name: { id: '', en: '', zh: '' },
  type: 'asset',
  subtype: 'current_asset',
  normalBalance: 'debit',
  parentId: null,
  isPostable: true,
  isActive: true,
};

function flatten(nodes: COANode[], depth = 0): Array<COANode & { depth: number }> {
  return nodes.flatMap((node) => [{ ...node, depth }, ...flatten(node.children, depth + 1)]);
}

function toDraft(node: COANode): COAAccountDraft {
  return {
    id: node.id,
    code: node.code,
    name: {
      id: node.name.id ?? '',
      en: node.name.en ?? '',
      zh: node.name.zh ?? '',
    },
    type: node.type,
    subtype: node.subtype,
    normalBalance: node.normalBalance,
    parentId: node.parentId,
    isPostable: node.isPostable,
    isActive: node.isActive,
  };
}

export function COAEditor({ tree }: Props) {
  const t = useTranslations('accounting.coa');
  const tc = useTranslations('common');
  const [draft, setDraft] = useState<COAAccountDraft>(blankDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const accounts = useMemo(() => flatten(tree), [tree]);

  const selectedId = draft.id ?? '';

  function update(patch: Partial<COAAccountDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateName(locale: 'id' | 'en' | 'zh', value: string) {
    setDraft((current) => ({ ...current, name: { ...current.name, [locale]: value } }));
  }

  async function save() {
    setMessage(null);
    const result = await saveCOAAccount(draft);
    setMessage(result.success ? t('saved') : result.error);
    if (result.success) {
      startTransition(() => window.location.reload());
    }
  }

  async function remove() {
    if (!draft.id) return;
    setMessage(null);
    const result = await deleteCOAAccount({ id: draft.id });
    setMessage(result.success ? t('deactivated') : result.error);
    if (result.success) {
      setDraft(blankDraft);
      startTransition(() => window.location.reload());
    }
  }

  return (
    <section className="surface-card p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-ink">{t('manage')}</h2>
          <p className="mt-1 text-sm text-brand-ink-3">
            {t('subtitle')}
          </p>
        </div>
        <select
          value={selectedId}
          onChange={(event) => {
            const node = accounts.find((account) => account.id === event.target.value);
            setDraft(node ? toDraft(node) : blankDraft);
            setMessage(null);
          }}
          className="h-10 min-w-72 rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink"
        >
          <option value="">{t('newAccount')}</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {' '.repeat(account.depth * 2)}
              {account.code} - {account.name.id ?? account.name.en ?? account.code}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div className="mb-4 rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2 text-sm text-brand-ink-2">
          {message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Kode">
          <input
            value={draft.code}
            onChange={(event) => update({ code: event.target.value })}
            placeholder="1-1100"
            className={fieldClass}
          />
        </Field>
        <Field label="Nama ID">
          <input
            value={draft.name.id}
            onChange={(event) => updateName('id', event.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="Nama EN">
          <input
            value={draft.name.en}
            onChange={(event) => updateName('en', event.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="Nama ZH">
          <input
            value={draft.name.zh}
            onChange={(event) => updateName('zh', event.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="Tipe">
          <select
            value={draft.type}
            onChange={(event) => update({ type: event.target.value })}
            className={fieldClass}
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subtipe">
          <input
            value={draft.subtype}
            onChange={(event) => update({ subtype: event.target.value })}
            className={fieldClass}
          />
        </Field>
        <Field label="Normal balance">
          <select
            value={draft.normalBalance}
            onChange={(event) => update({ normalBalance: event.target.value })}
            className={fieldClass}
          >
            {NORMAL_BALANCES.map((balance) => (
              <option key={balance} value={balance}>
                {balance}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Parent">
          <select
            value={draft.parentId ?? ''}
            onChange={(event) => update({ parentId: event.target.value || null })}
            className={fieldClass}
          >
            <option value="">{tc('labels.noParent')}</option>
            {accounts
              .filter((account) => account.id !== draft.id)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {' '.repeat(account.depth * 2)}
                  {account.code} - {account.name.id ?? account.name.en ?? account.code}
                </option>
              ))}
          </select>
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-brand-ink-2">
          <input
            type="checkbox"
            checked={draft.isPostable}
            onChange={(event) => update({ isPostable: event.target.checked })}
          />
          {tc('labels.postable')}
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-brand-ink-2">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(event) => update({ isActive: event.target.checked })}
          />
          {tc('status.active')}
        </label>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red/90 disabled:opacity-60"
        >
          {t('saveAccount')}
        </button>
        {draft.id && (
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="rounded-md border border-brand-red px-4 py-2 text-sm font-semibold text-brand-red hover:bg-brand-red/5 disabled:opacity-60"
          >
            {tc('actions.deactivate')}
          </button>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-brand-ink-3">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
