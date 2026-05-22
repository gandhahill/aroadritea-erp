'use client';

import { formatRupiah } from '@erp/shared/money';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteStatement, fetchJournalSuggestions, finalizeStatement, matchLine, unmatchLine } from '../actions';

interface Line {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  isMatched: boolean;
  matchedJournalId: string | null;
}

interface Statement {
  id: string;
  date: string;
  bankName: string;
  accountNumber: string;
  status: string;
  openingBalance: number;
  closingBalance: number;
}

interface Labels {
  back: string;
  finalize: string;
  finalizing: string;
  finalized: string;
  delete: string;
  deleteConfirm: string;
  deleteSuccess: string;
  deleteFailed: string;
  match: string;
  unmatch: string;
  matched: string;
  unmatched: string;
  created: string;
  createJournal: string;
  suggestMatches: string;
  suggesting: string;
  suggested: string;
  noSuggestions: string;
  detail: {
    matchedCount: string;
    allMatched: string;
    unmatchedWarning: string;
    selectJournal: string;
    noJournalSuggestion: string;
    matchSuccess: string;
    unmatchSuccess: string;
    journalCreated: string;
    cancel: string;
    ref: string;
  };
  columns: {
    date: string;
    description: string;
    debit: string;
    credit: string;
    balance: string;
    matchStatus: string;
    journal: string;
    actions: string;
  };
  summary: {
    matched: string;
    unmatched: string;
    total: string;
  };
}

interface Props {
  statement: Statement;
  lines: Line[];
  labels: Labels;
}

export function DetailClient({ statement, lines, labels }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ id: string; date: string; description: string; amount: number }[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  const matchedCount = lines.filter(l => l.isMatched).length;
  const totalCount = lines.length;
  const isAllMatched = matchedCount === totalCount && totalCount > 0;
  const isFinalized = statement.status === 'reconciled';

  const handleFinalize = () => {
    startTransition(async () => {
      const res = await finalizeStatement(statement.id);
      if (res.success) {
        // success
      } else {
        alert(res.error);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(labels.deleteConfirm)) return;
    startTransition(async () => {
      const res = await deleteStatement(statement.id);
      if (res.success) {
        router.push('/accounting/bank-recon');
      } else {
        alert(res.error || labels.deleteFailed);
      }
    });
  };

  const loadSuggestions = async (lineId: string) => {
    setIsFetchingSuggestions(true);
    setSuggestions([]);
    try {
      const data = await fetchJournalSuggestions(lineId);
      // We need to cast amount to number because BigInt is returned from db as bigint/string depending on driver
      setSuggestions(data.map(d => ({ ...d, amount: Number(d.amount) })));
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingSuggestions(false);
    }
  };

  const handleMatch = async (lineId: string, journalId: string) => {
    startTransition(async () => {
      const res = await matchLine(lineId, journalId);
      if (!res.success) {
        alert(res.error);
      } else {
        setActiveLineId(null);
      }
    });
  };

  const handleUnmatch = async (lineId: string) => {
    startTransition(async () => {
      const res = await unmatchLine(lineId);
      if (!res.success) {
        alert(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Actions & Summary */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/accounting/bank-recon')}
            className="rounded-md border border-brand-cream-3 px-4 py-2 text-sm font-semibold text-brand-ink-3 hover:text-brand-ink"
          >
            &larr; {labels.back}
          </button>
          {!isFinalized && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-md border border-brand-cream-3 px-4 py-2 text-sm font-semibold text-brand-red hover:bg-brand-red/5 disabled:opacity-50"
            >
              {labels.delete}
            </button>
          )}
        </div>
        {!isFinalized && (
          <button
            onClick={handleFinalize}
            disabled={isPending || !isAllMatched}
            className="rounded-md bg-brand-jade px-6 py-2 text-sm font-semibold text-white hover:bg-brand-jade-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? labels.finalizing : labels.finalize}
          </button>
        )}
      </div>

      {!isAllMatched && !isFinalized && (
        <div className="rounded-md bg-brand-sand/20 p-4 text-sm text-brand-brown">
          {labels.detail.unmatchedWarning.replace('{count}', String(totalCount - matchedCount))}
        </div>
      )}
      {isAllMatched && !isFinalized && (
        <div className="rounded-md bg-brand-jade/10 p-4 text-sm text-brand-jade">
          {labels.detail.allMatched}
        </div>
      )}

      {/* Lines Table */}
      <div className="overflow-x-auto rounded-lg border border-brand-cream-3 bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-cream-2 text-xs uppercase tracking-widest text-brand-ink-3">
            <tr>
              <th className="px-3 py-3 w-28">{labels.columns.date}</th>
              <th className="px-3 py-3">{labels.columns.description}</th>
              <th className="px-3 py-3 w-32 text-right">{labels.columns.debit}</th>
              <th className="px-3 py-3 w-32 text-right">{labels.columns.credit}</th>
              <th className="px-3 py-3 w-32 text-center">{labels.columns.matchStatus}</th>
              <th className="px-3 py-3 w-40 text-center">{labels.columns.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3">
            {lines.map((line) => (
              <tr key={line.id} className={`align-top ${line.isMatched ? 'bg-brand-cream-1/30' : ''}`}>
                <td className="px-3 py-4">{line.date}</td>
                <td className="px-3 py-4">{line.description}</td>
                <td className="px-3 py-4 text-right tabular-nums">{formatRupiah(BigInt(line.debit))}</td>
                <td className="px-3 py-4 text-right tabular-nums">{formatRupiah(BigInt(line.credit))}</td>
                <td className="px-3 py-4 text-center">
                  {line.isMatched ? (
                    <span className="inline-flex rounded-full bg-brand-jade/10 px-2.5 py-0.5 text-xs font-semibold text-brand-jade">
                      {labels.matched}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-brand-red/10 px-2.5 py-0.5 text-xs font-semibold text-brand-red">
                      {labels.unmatched}
                    </span>
                  )}
                  {line.isMatched && (
                    <div className="mt-1 text-xs text-brand-ink-3">
                      {labels.detail.ref}{line.matchedJournalId?.slice(0, 8)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-4 text-center">
                  {!isFinalized && (
                    <>
                      {line.isMatched ? (
                        <button
                          onClick={() => handleUnmatch(line.id)}
                          disabled={isPending}
                          className="text-xs font-semibold text-brand-red hover:underline disabled:opacity-50"
                        >
                          {labels.unmatch}
                        </button>
                      ) : (
                        <div className="relative">
                          <button
                            onClick={() => {
                              setActiveLineId(activeLineId === line.id ? null : line.id);
                              if (activeLineId !== line.id) loadSuggestions(line.id);
                            }}
                            disabled={isPending}
                            className="text-xs font-semibold text-brand-ink hover:text-brand-red hover:underline disabled:opacity-50"
                          >
                            {labels.match}
                          </button>
                          
                          {activeLineId === line.id && (
                            <div className="absolute right-0 top-6 z-10 w-80 rounded-lg border border-brand-cream-3 bg-white p-3 shadow-lg">
                              <div className="mb-2 text-left text-xs font-bold text-brand-ink">
                                {labels.suggestMatches}
                              </div>
                              {isFetchingSuggestions ? (
                                <div className="text-left text-xs text-brand-ink-3">{labels.suggesting}</div>
                              ) : suggestions.length > 0 ? (
                                <ul className="space-y-2">
                                  {suggestions.map((s) => (
                                    <li key={s.id} className="flex flex-col gap-1 rounded border border-brand-cream-3 p-2 text-left hover:bg-brand-cream-1">
                                      <div className="flex items-start justify-between">
                                        <span className="text-xs font-medium text-brand-ink">{s.date}</span>
                                        <span className="text-xs font-bold text-brand-ink">{formatRupiah(BigInt(s.amount))}</span>
                                      </div>
                                      <div className="text-[10px] text-brand-ink-3">{s.description}</div>
                                      <button
                                        onClick={() => handleMatch(line.id, s.id)}
                                        className="mt-1 w-full rounded bg-brand-red py-1 text-xs font-semibold text-white hover:bg-brand-red-dark"
                                      >
                                        {labels.match}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-left text-xs text-brand-ink-3">{labels.noSuggestions}</div>
                              )}
                              
                              <button
                                onClick={() => setActiveLineId(null)}
                                className="mt-3 text-xs text-brand-ink-3 hover:underline"
                              >
                                {labels.detail.cancel}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
