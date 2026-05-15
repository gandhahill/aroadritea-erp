import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchJournalFormData } from '../actions';
import { JournalForm } from './journal-form';

export const metadata: Metadata = {
  title: 'New Journal - Aroadri ERP',
};

export default async function NewJournalPage() {
  const data = await fetchJournalFormData();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/accounting/journals"
          className="text-sm font-medium text-brand-ink-3 transition-colors hover:text-brand-ink"
        >
          Kembali ke Journal Entries
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-brand-ink">New Journal Entry</h1>
        <p className="mt-1 text-sm text-brand-ink-3">
          Buat draft jurnal manual. Posting dilakukan dari halaman detail setelah data direview.
        </p>
      </div>

      {data.accounts.length === 0 || data.locations.length === 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Account postable atau lokasi aktif belum tersedia, atau akun Anda tidak memiliki akses
          accounting.
        </div>
      ) : null}

      <JournalForm accounts={data.accounts} locations={data.locations} />
    </div>
  );
}
