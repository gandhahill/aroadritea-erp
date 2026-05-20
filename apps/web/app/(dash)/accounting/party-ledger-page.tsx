import { getTranslations } from 'next-intl/server';
import {
  type PartyLedgerKind,
  getPartyLedgerData,
  saveReceivableAllowanceRatesAction,
  savePartyLedgerSettingsAction,
  updatePartyLedgerDueDateAction,
} from './party-ledger-actions';

interface Props {
  kind: PartyLedgerKind;
}

export async function PartyLedgerPage({ kind }: Props) {
  const [data, t] = await Promise.all([
    getPartyLedgerData(kind),
    getTranslations('accounting.partyLedger'),
  ]);
  const title = kind === 'payables' ? t('payablesTitle') : t('receivablesTitle');
  const subtitle = kind === 'payables' ? t('payablesSubtitle') : t('receivablesSubtitle');

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-red">
            {t('eyebrow')}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-brand-ink">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-ink-2">{subtitle}</p>
        </div>
        <div className="rounded-md border border-brand-cream-3 bg-brand-cream-1 px-4 py-3 text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink-3">
            {t('totalOutstanding')}
          </p>
          <p className="mt-1 text-xl font-bold text-brand-red">
            {formatRupiah(data.totalOutstanding)}
          </p>
        </div>
      </header>

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
                  {localized(account.name)}
                  <span className="block text-xs text-brand-ink-3">{account.subtype}</span>
                </span>
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red/90"
          >
            {t('saveMapping')}
          </button>
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
                <AllowanceStat label={t('current')} value={data.allowanceEstimate.current} />
                <AllowanceStat label="1-30" value={data.allowanceEstimate.days1To30} />
                <AllowanceStat label="31-60" value={data.allowanceEstimate.days31To60} />
                <AllowanceStat label=">60" value={data.allowanceEstimate.over60} />
              </div>
              <p className="mt-3 text-lg font-bold text-brand-red">
                {formatRupiah(data.allowanceEstimate.total)}
              </p>
            </div>
            <form action={saveReceivableAllowanceRatesAction} className="grid gap-2 sm:grid-cols-4">
              {(
                [
                  ['current', t('current')],
                  ['days1To30', '1-30'],
                  ['days31To60', '31-60'],
                  ['over60', '>60'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-xs font-semibold text-brand-ink-3">
                  {label} bps
                  <input
                    name={key}
                    type="number"
                    min={0}
                    max={10000}
                    defaultValue={data.allowanceRatesBps[key]}
                    className="mt-1 w-full rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink"
                  />
                </label>
              ))}
              <button
                type="submit"
                className="sm:col-span-4 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red/90"
              >
                {t('saveAllowance')}
              </button>
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
            <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
              <thead className="bg-brand-cream-1 text-left text-xs uppercase tracking-wide text-brand-ink-3">
                <tr>
                  <th className="px-4 py-3">{t('partner')}</th>
                  <th className="px-4 py-3 text-right">{t('current')}</th>
                  <th className="px-4 py-3 text-right">1-30</th>
                  <th className="px-4 py-3 text-right">31-60</th>
                  <th className="px-4 py-3 text-right">&gt;60</th>
                  <th className="px-4 py-3 text-right">{t('total')}</th>
                  <th className="px-4 py-3">{t('accounts')}</th>
                  <th className="px-4 py-3">{t('dueDates')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-cream-3">
                {data.rows.map((row) => (
                  <tr key={row.partnerId ?? 'no-partner'} className="align-top">
                    <td className="px-4 py-3 font-medium text-brand-ink">{row.partnerName}</td>
                    <AmountCell value={row.current} />
                    <AmountCell value={row.days1To30} />
                    <AmountCell value={row.days31To60} />
                    <AmountCell value={row.over60} />
                    <AmountCell value={row.total} strong />
                    <td className="px-4 py-3 text-xs leading-5 text-brand-ink-3">
                      {row.accountBreakdown.map((account) => (
                        <div key={account.accountId}>
                          {account.accountCode}: {formatRupiah(account.amount)}
                        </div>
                      ))}
                    </td>
                    <td className="min-w-80 px-4 py-3">
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
                                {entry.accountCode} | {formatRupiah(entry.amount)}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AllowanceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-brand-cream-3 bg-brand-cream-1 px-3 py-2">
      <p className="text-xs font-semibold text-brand-ink-3">{label}</p>
      <p className="mt-1 font-semibold text-brand-ink">{formatRupiah(value)}</p>
    </div>
  );
}

function AmountCell({ value, strong = false }: { value: string; strong?: boolean }) {
  return (
    <td
      className={`px-4 py-3 text-right tabular-nums ${
        strong ? 'font-semibold text-brand-red' : 'text-brand-ink-2'
      }`}
    >
      {formatRupiah(value)}
    </td>
  );
}

function localized(value: Record<string, string>) {
  return value.id ?? value.en ?? value.zh ?? '';
}

function formatRupiah(value: string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(BigInt(value)));
}
