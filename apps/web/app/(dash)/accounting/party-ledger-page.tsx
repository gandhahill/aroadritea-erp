import { PageHeader } from '@/components/page-header';
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader } from '@erp/ui';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  type PartyLedgerKind,
  getPartyLedgerData,
  savePartyLedgerSettingsAction,
  saveReceivableAllowanceRatesAction,
  updatePartyLedgerDueDateAction,
} from './party-ledger-actions';

interface Props {
  kind: PartyLedgerKind;
}

export async function PartyLedgerPage({ kind }: Props) {
  const [data, t, locale] = await Promise.all([
    getPartyLedgerData(kind),
    getTranslations('accounting.partyLedger'),
    getLocale(),
  ]);
  const title = kind === 'payables' ? t('payablesTitle') : t('receivablesTitle');
  const subtitle = kind === 'payables' ? t('payablesSubtitle') : t('receivablesSubtitle');

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{title}</>}
        description={<>{subtitle}</>}
        eyebrow={<>{t('eyebrow')}</>}
        actions={
          <>
            <div className="rounded-md border border-brand-cream-3 bg-brand-cream-1 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink-3">
                {t('totalOutstanding')}
              </p>
              <p className="mt-1 text-xl font-bold text-brand-red">
                {formatRupiah(data.totalOutstanding, locale)}
              </p>
            </div>
          </>
        }
      />

      <section className="surface-card p-4">
        <h2 className="text-sm font-semibold text-brand-ink">{t('accountMapping')}</h2>
        <p className="mt-1 text-sm leading-6 text-brand-ink-3">{t('accountMappingHelp')}</p>
        <form action={savePartyLedgerSettingsAction} className="mt-4 space-y-4">
          <input type="hidden" name="kind" value={kind} />
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.accountOptions.map((account) => (
              <label
                key={account.id}
                className="flex items-start gap-2 rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink"
              >
                <input
                  type="checkbox"
                  name="accountIds"
                  value={account.id}
                  defaultChecked={account.selected}
                  className="mt-1 h-4 w-4 rounded border-brand-cream-3 text-brand-red"
                />
                <span>
                  <span className="font-semibold">{account.code}</span>{' '}
                  {localized(account.name, locale)}
                </span>
              </label>
            ))}
          </div>
          <Button
            type="submit"
            className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red/90"
            variant="primary"
            size="md"
          >
            {t('saveMapping')}
          </Button>
        </form>
      </section>

      {kind === 'receivables' && data.allowanceEstimate ? (
        <section className="surface-card p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-brand-ink">{t('allowanceTitle')}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-ink-3">
                {t('allowanceHelp')}
              </p>
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                <AllowanceStat
                  label={t('current')}
                  value={data.allowanceEstimate.current}
                  locale={locale}
                />
                <AllowanceStat
                  label={t('days1To30')}
                  value={data.allowanceEstimate.days1To30}
                  locale={locale}
                />
                <AllowanceStat
                  label={t('days31To60')}
                  value={data.allowanceEstimate.days31To60}
                  locale={locale}
                />
                <AllowanceStat
                  label={t('over60')}
                  value={data.allowanceEstimate.over60}
                  locale={locale}
                />
              </div>
              <p className="mt-3 text-lg font-bold text-brand-red">
                {formatRupiah(data.allowanceEstimate.total, locale)}
              </p>
            </div>
            <form action={saveReceivableAllowanceRatesAction} className="grid gap-2 sm:grid-cols-4">
              {(
                [
                  ['current', t('current')],
                  ['days1To30', t('days1To30')],
                  ['days31To60', t('days31To60')],
                  ['over60', t('over60')],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-xs font-semibold text-brand-ink-3">
                  {t('allowanceRateLabel', { bucket: label })}
                  <Input
                    name={key}
                    type="number"
                    min={0}
                    max={10000}
                    defaultValue={data.allowanceRatesBps[key]}
                    className="mt-1 w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink"
                  />
                </label>
              ))}
              <Button
                type="submit"
                className="sm:col-span-4 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red/90"
                variant="primary"
                size="md"
              >
                {t('saveAllowance')}
              </Button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="surface-card overflow-hidden">
        <div className="border-b border-brand-cream-3 px-4 py-3">
          <h2 className="text-sm font-semibold text-brand-ink">{t('ledger')}</h2>
          <p className="mt-1 text-xs text-brand-ink-3">{t('ledgerHelp')}</p>
        </div>
        {data.rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-brand-ink-3">{t('empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-brand-cream-1 text-left text-xs uppercase tracking-wide text-brand-ink-3">
                <tr>
                  <TableHead className="px-4 py-3">{t('partner')}</TableHead>
                  <TableHead className="px-4 py-3 text-right">{t('current')}</TableHead>
                  <TableHead className="px-4 py-3 text-right">{t('days1To30')}</TableHead>
                  <TableHead className="px-4 py-3 text-right">{t('days31To60')}</TableHead>
                  <TableHead className="px-4 py-3 text-right">{t('over60')}</TableHead>
                  <TableHead className="px-4 py-3 text-right">{t('total')}</TableHead>
                  <TableHead className="px-4 py-3">{t('accounts')}</TableHead>
                  <TableHead className="px-4 py-3">{t('dueDates')}</TableHead>
                </tr>
              </TableHeader>
              <TableBody className="divide-y divide-brand-cream-3">
                {data.rows.map((row) => (
                  <tr key={row.partnerId ?? 'no-partner'} className="align-top">
                    <TableCell className="px-4 py-3 font-medium text-brand-ink">
                      {row.partnerName ?? t('noPartner')}
                    </TableCell>
                    <AmountCell value={row.current} locale={locale} />
                    <AmountCell value={row.days1To30} locale={locale} />
                    <AmountCell value={row.days31To60} locale={locale} />
                    <AmountCell value={row.over60} locale={locale} />
                    <AmountCell value={row.total} locale={locale} strong />
                    <TableCell className="px-4 py-3 text-xs leading-5 text-brand-ink-3">
                      {row.accountBreakdown.map((account) => (
                        <div key={account.accountId}>
                          {account.accountCode} {localized(account.accountName, locale)}:{' '}
                          {formatRupiah(account.amount, locale)}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="min-w-80 px-4 py-3">
                      <div className="space-y-2">
                        {row.entries.slice(0, 4).map((entry) => (
                          <form
                            key={entry.journalLineId}
                            action={updatePartyLedgerDueDateAction}
                            className="grid gap-2 rounded-md border border-brand-cream-3 bg-brand-cream-1 p-2 text-xs md:grid-cols-[1fr_130px_72px_auto]"
                          >
                            <input type="hidden" name="kind" value={kind} />
                            <input type="hidden" name="journalLineId" value={entry.journalLineId} />
                            <div className="text-brand-ink-3">
                              <span className="font-semibold text-brand-ink">
                                {entry.journalNumber}
                              </span>
                              <span className="block">
                                {entry.accountCode} | {formatRupiah(entry.amount, locale)}
                              </span>
                            </div>
                            <input
                              name="dueDate"
                              type="date"
                              defaultValue={entry.dueDate ?? ''}
                              className="rounded border border-brand-cream-3 bg-card px-2 py-1 text-brand-ink"
                            />
                            <input
                              name="reminderDaysBefore"
                              type="number"
                              min={0}
                              max={365}
                              defaultValue={entry.reminderDaysBefore ?? ''}
                              className="rounded border border-brand-cream-3 bg-card px-2 py-1 text-brand-ink"
                            />
                            <button
                              type="submit"
                              className="rounded bg-brand-red px-2 py-1 font-semibold text-white"
                            >
                              {t('saveDueDate')}
                            </button>
                          </form>
                        ))}
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function AllowanceStat({
  label,
  value,
  locale,
}: {
  label: string;
  value: string;
  locale: string;
}) {
  return (
    <div className="rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2">
      <p className="text-xs font-semibold text-brand-ink-3">{label}</p>
      <p className="mt-1 font-semibold text-brand-ink">{formatRupiah(value, locale)}</p>
    </div>
  );
}

function AmountCell({
  value,
  locale,
  strong = false,
}: {
  value: string;
  locale: string;
  strong?: boolean;
}) {
  return (
    <TableCell
      className={`px-4 py-3 text-right tabular-nums ${
        strong ? 'font-semibold text-brand-red' : 'text-brand-ink-2'
      }`}
    >
      {formatRupiah(value, locale)}
    </TableCell>
  );
}

function localized(value: Record<string, string>, locale: string) {
  if (locale === 'en') return value.en ?? value.id ?? value.zh ?? '';
  if (locale === 'zh') return value.zh ?? value.id ?? value.en ?? '';
  return value.id ?? value.en ?? value.zh ?? '';
}

function formatRupiah(value: string, locale = 'id-ID') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(BigInt(value)));
}
