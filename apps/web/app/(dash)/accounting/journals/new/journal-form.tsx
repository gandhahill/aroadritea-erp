'use client';

import { pickLocalized } from '@/lib/pick-localized';
import {
  Button,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  toast,
} from '@erp/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import {
  type JournalFormAccount,
  type JournalFormLocation,
  type JournalFormPartner,
  createJournalAction,
} from '../actions';
import { uploadAttachmentAction } from '../attachments/actions';

interface LineDraft {
  key: number;
  accountId: string;
  locationId: string;
  description: string;
  debit: string;
  credit: string;
  partnerId: string;
  dueDate: string;
  reminderDaysBefore: string;
}

interface Props {
  accounts: JournalFormAccount[];
  locations: JournalFormLocation[];
  partners: JournalFormPartner[];
}

export function JournalForm({ accounts, locations, partners }: Props) {
  const t = useTranslations('accounting.journal');
  const tc = useTranslations('common');
  const locale = useLocale();
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
      partnerId: '',
      dueDate: '',
      reminderDaysBefore: '',
    },
    {
      key: 1,
      accountId: '',
      locationId: defaultLocationId,
      description: '',
      debit: '',
      credit: '',
      partnerId: '',
      dueDate: '',
      reminderDaysBefore: '',
    },
  ]);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!state?.ok || !state.journalId) return;
    const journalId = state.journalId;
    if (pendingFiles.length === 0) {
      router.push(`/accounting/journals/${journalId}`);
      toast.success(tc('actions.successSaved'));
      router.refresh();
      return;
    }
    let cancelled = false;
    (async () => {
      setUploadingAttachments(true);
      setUploadError(null);
      try {
        for (const file of pendingFiles) {
          const fd = new FormData();
          fd.append('journalEntryId', journalId);
          fd.append('file', file);
          const res = await uploadAttachmentAction(fd);
          if (res && 'error' in res && res.error) {
            throw new Error(res.error);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setUploadError(err instanceof Error ? err.message : t('errors.uploadFailed'));
          setUploadingAttachments(false);
          return;
        }
      }
      if (!cancelled) {
        setUploadingAttachments(false);
        router.push(`/accounting/journals/${journalId}`);
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, state, pendingFiles]);

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
        partnerId: '',
        dueDate: '',
        reminderDaysBefore: '',
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
            <Input name="postingDate" type="date" required defaultValue={today} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{tc('labels.location')}</span>
            <Select name="locationId" required defaultValue={defaultLocationId}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} - {location.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-brand-ink">{tc('labels.description')}</span>
            <Input name="description" required />
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-brand-ink">{t('referenceId')}</span>
            <Input name="referenceId" />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-brand-cream-3 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-brand-ink">{t('linesSection')}</h2>
            <p className="text-sm text-brand-ink-3">{t('linesHint')}</p>
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
          <Table>
            <TableHeader>
              <tr>
                <TableHead className="px-4 py-3">{tc('labels.account')}</TableHead>
                <TableHead className="px-4 py-3">{tc('labels.description')}</TableHead>
                <TableHead className="px-4 py-3">{t('partner')}</TableHead>
                <TableHead className="px-4 py-3">{t('dueDate')}</TableHead>
                <TableHead className="px-4 py-3">{t('reminderDaysBefore')}</TableHead>
                <TableHead className="px-4 py-3">{tc('labels.location')}</TableHead>
                <TableHead className="px-4 py-3 text-right">{t('debit')}</TableHead>
                <TableHead className="px-4 py-3 text-right">{t('credit')}</TableHead>
                <TableHead className="px-4 py-3" />
              </tr>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => (
                <tr key={line.key}>
                  <TableCell className="min-w-72 px-4 py-3">
                    <Select
                      name={`accountId-${index}`}
                      required
                      value={line.accountId}
                      onChange={(event) => updateLine(line.key, { accountId: event.target.value })}
                    >
                      <option value="">{t('selectAccount')}</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {pickLocalized(account.name, locale, account.code)}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell className="min-w-56 px-4 py-3">
                    <Input
                      name={`lineDescription-${index}`}
                      value={line.description}
                      onChange={(event) =>
                        updateLine(line.key, { description: event.target.value })
                      }
                    />
                  </TableCell>
                  <TableCell className="min-w-52 px-4 py-3">
                    <Select
                      name={`partnerId-${index}`}
                      value={line.partnerId}
                      onChange={(event) => updateLine(line.key, { partnerId: event.target.value })}
                    >
                      <option value="">{t('noPartner')}</option>
                      {partners.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name} ({partner.kind})
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell className="min-w-40 px-4 py-3">
                    <Input
                      name={`dueDate-${index}`}
                      type="date"
                      value={line.dueDate}
                      onChange={(event) => updateLine(line.key, { dueDate: event.target.value })}
                    />
                  </TableCell>
                  <TableCell className="min-w-28 px-4 py-3">
                    <Input
                      name={`reminderDaysBefore-${index}`}
                      type="number"
                      min={0}
                      max={365}
                      value={line.reminderDaysBefore}
                      onChange={(event) =>
                        updateLine(line.key, { reminderDaysBefore: event.target.value })
                      }
                    />
                  </TableCell>
                  <TableCell className="min-w-52 px-4 py-3">
                    <Select
                      name={`lineLocationId-${index}`}
                      value={line.locationId || defaultLocationId}
                      onChange={(event) => updateLine(line.key, { locationId: event.target.value })}
                    >
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.code}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell className="min-w-36 px-4 py-3">
                    <Input
                      name={`debit-${index}`}
                      inputMode="numeric"
                      value={line.debit}
                      onChange={(event) =>
                        updateLine(line.key, { debit: event.target.value, credit: '' })
                      }
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell className="min-w-36 px-4 py-3">
                    <Input
                      name={`credit-${index}`}
                      inputMode="numeric"
                      value={line.credit}
                      onChange={(event) =>
                        updateLine(line.key, { credit: event.target.value, debit: '' })
                      }
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length <= 2}
                      className="rounded-md "
                      variant="danger"
                      size="sm"
                    >
                      {t('deleteItem')}
                    </Button>
                  </TableCell>
                </tr>
              ))}
            </TableBody>
            <tfoot className="bg-brand-cream-1 text-sm font-semibold text-brand-ink">
              <tr>
                <TableCell className="px-4 py-3" colSpan={6}>
                  Total
                </TableCell>
                <TableCell className="px-4 py-3 text-right">{formatRupiah(totals.debit)}</TableCell>
                <TableCell className="px-4 py-3 text-right">
                  {formatRupiah(totals.credit)}
                </TableCell>
                <TableCell className="px-4 py-3">
                  {totals.debit === totals.credit && totals.debit > 0 ? (
                    <span className="rounded-full bg-brand-jade-light px-2 py-1 text-xs text-brand-jade">
                      {t('balanced')}
                    </span>
                  ) : (
                    <span className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-700">
                      {t('notBalanced')}
                    </span>
                  )}
                </TableCell>
              </tr>
            </tfoot>
          </Table>
        </div>
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">
          {tc('labels.attachmentsOptional', { fallback: 'Lampiran (opsional)' })}
        </h2>
        <p className="mt-1 text-sm text-brand-ink-3">{t('attachmentHint')}</p>
        <div className="mt-3 space-y-2">
          <Input
            type="file"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setPendingFiles(files);
            }}
            className="block w-full text-sm text-brand-ink-2 file:mr-4 file:rounded-md file:border-0 file:bg-brand-red file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-red-dark"
          />
          {pendingFiles.length > 0 ? (
            <ul className="text-xs text-brand-ink-3">
              {pendingFiles.map((f) => (
                <li key={f.name}>
                  • {f.name} ({Math.round(f.size / 1024)} KB)
                </li>
              ))}
            </ul>
          ) : null}
          {uploadError ? <p className="text-xs text-rose-600">{uploadError}</p> : null}
          {uploadingAttachments ? (
            <p className="text-xs text-brand-ink-3">
              {tc('actions.uploading', { fallback: 'Mengunggah lampiran…' })}
            </p>
          ) : null}
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          onClick={() => router.push('/accounting/journals')}
          className="rounded-lg "
          variant="secondary"
          size="md"
        >
          {tc('actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={
            isPending || uploadingAttachments || accounts.length === 0 || locations.length === 0
          }
          className="rounded-lg "
          variant="primary"
          size="lg"
        >
          {isPending || uploadingAttachments ? t('saving') : t('saveDraft')}
        </Button>
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
