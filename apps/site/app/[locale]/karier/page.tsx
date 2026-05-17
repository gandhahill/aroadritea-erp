/**
 * Public careers / lowongan page — fetches open job openings + lets
 * applicants submit a basic application form.
 */

import type { Metadata } from 'next';
import { CareersClient } from './careers-client';

export const metadata: Metadata = {
  title: 'Karier — Aroadri Tea',
};

export const dynamic = 'force-dynamic';

export default function CareersPage() {
  return (
    <div className="px-4 py-14 sm:px-6">
      <article className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-black text-brand-ink md:text-5xl">Bergabung dengan tim Aroadri Tea</h1>
        <p className="mt-4 max-w-2xl text-base text-brand-ink-2">
          Kami terus mencari teman baru untuk outlet di Yogyakarta dan tim back
          office. Lihat lowongan terbuka di bawah, lalu kirim aplikasi langsung
          dari halaman ini.
        </p>
        <div className="mt-8">
          <CareersClient />
        </div>
      </article>
    </div>
  );
}
