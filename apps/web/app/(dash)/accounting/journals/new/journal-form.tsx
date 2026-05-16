'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { type JournalFormAccount, type JournalFormLocation, createJournalAction } from '../actions';

const INPUT =
  'w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5';

interface LineDraft {
  key: number;
  accountId: string;
  locationId: string;
  description: string;
  debit: string;
  credit: string;
}

interface Props {
  accounts: JournalFormAccount[];
  locations: JournalFormLocation[];
}

export function JournalForm({ accounts, locations }: Props) {
  const t = useTranslations('accounting.journal');
  const tc = useTranslations('common');
  const router = useRouter();
  const [state, submitAction, isPending] = useActionState(createJournalAction, null);
  const defaultLocationId = locations[0]?.id ?? '';
  const today = new Date().toISOString().slice(0, 10);
  const [lines, setLines] = useState<LineDraft[]>([
    {
      key: 0,
      accountId: '',
      locationId: defaultLocationId,
      description: '',
      debit: '',
      credit: '',
    },
    {
      key: 1,
      accountId: '',
      locationId: defaultLocationId,
      description: '',
      debit: '',
      credit: '',
    },
  ]);

  useEffect(() => {
    if (!state?.ok || !state.journalId) return;
    router.push(`/accounting/journals/${state.journalId}`);
    router.refresh();
  }, [router, state]);

  const totals = useMemo(() => {
    return lines.reduce(
      (sum, line) => ({
        debit: sum.debit + parseMoney(line.debit),
        credit: sum.credit + parseMoney(line.credit),
      }),
      { debit: 0, credit: 0 },
    );
  }, [lines]);

  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => [
      ...current,
      {
        key: Math.max(...current.map((line) => line.key)) + 1,
        accountId: '',
        locationId: defaultLocationId,
        description: '',
        debit: '',
        credit: '',
      },
    ]);
  }

  function removeLine(key: number) {
    setLines((current) =>
      current.length > 2 ? current.filter((line) => line.key !== key) : current,
    );
  }

  return (
    <form action={submitAction} className="space-y-6">
      <input type="hidden" name="lineCount" value={lines.length} />

      {state?.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">{t('headerSection')}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{t('postingDate')}</span>
            <input name="postingDate" type="date" required defaultValue={today} className={INPUT} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{tc('labels.location')}</span>
            <select name="locationId" required defaultValue={defaultLocationId} className={INPUT}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} - {location.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-brand-ink">{tc('labels.description')}</span>
            <input name="description" required className={INPUT} />
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-brand-ink">Reference ID</span>
            <input name="referenceId" className={INPUT} />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-brand-cream-3 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-brand-ink">{t('linesSection')}</h2>
            <p className="text-sm text-brand-ink-3">
              {t('linesHint')}
            </p>
          </div>
          <button
            type="button"
            onClick={addLine}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-1.5 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
          >
            {t('addLine')}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
            <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              <tr>
                <th className="px-4 py-3">{tc('labels.account')}</th>
                <th className="px-4 py-3">{tc('labels.description')}</th>
                <th className="px-4 py-3">{tc('labels.location')}</th>
                <th className="px-4 py-3 text-right">{t('debit')}</th>
                <th className="px-4 py-3 text-right">{t('credit')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3 bg-card">
              {lines.map((line, index) => (
                <tr key={line.key}>
                  <td className="min-w-72 px-4 py-3">
                    <select
                      name={`accountId-${index}`}
                      required
                      value={line.accountId}
                      onChange={(event) => updateLine(line.key, { accountId: event.target.value })}
                      className={INPUT}
                    >
                      <option value="">{t('selectAccount')}</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name.id ?? account.name.en}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="min-w-56 px-4 py-3">
                    <input
                      name={`lineDescription-${index}`}
                      value={line.description}
                      onChange={(event) =>
                        updateLine(line.key, { description: event.target.value })
                      }
                      className={INPUT}
                    />
                  </td>
                  <td className="min-w-52 px-4 py-3">
                    <select
                      name={`lineLocationId-${index}`}
                      value={line.locationId || defaultLocationId}
                      onChange={(event) => updateLine(line.key, { locationId: event.target.value })}
                      className={INPUT}
                    >
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="min-w-36 px-4 py-3">
                    <input
                      name={`debit-${index}`}
                      inputMode="numeric"
                      value={line.debit}
                      onChange={(event) =>
                        updateLine(line.key, { debit: event.target.value, credit: '' })
                      }
                      className={`${INPUT} text-right`}
                    />
                  </td>
                  <td className="min-w-36 px-4 py-3">
                    <input
                      name={`credit-${index}`}
                      inputMode="numeric"
                      value={line.credit}
                      onChange={(event) =>
                        updateLine(line.key, { credit: event.target.value, debit: '' })
                      }
                      className={`${INPUT} text-right`}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length <= 2}
                      className="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-30"
                    >
                      {t('deleteItem')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-brand-cream-1 text-sm font-semibold text-brand-ink">
              <tr>
                <td className="px-4 py-3" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-3 text-right">{formatRupiah(totals.debit)}</td>
                <td className="px-4 py-3 text-right">{formatRupiah(totals.credit)}</td>
                <td className="px-4 py-3">
                  {totals.debit === totals.credit && totals.debit > 0 ? (
                    <span className="rounded-full bg-brand-jade-light px-2 py-1 text-xs text-brand-jade">
                      {t('balanced')}
                    </span>
                  ) : (
                    <span className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-700">
                      {t('notBalanced')}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/accounting/journals')}
          className="rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
        >
          {tc('actions.cancel')}
        </button>
        <button
          type="submit"
          disabled={isPending || accounts.length === 0 || locations.length === 0}
          className="rounded-lg bg-brand-red px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
        >
          {isPending ? t('saving') : t('saveDraft')}
        </button>
      </div>
    </form>
  );
}

function parseMoney(value: string) {
  return Number(value.replace(/[^\d]/g, '') || '0');
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}
