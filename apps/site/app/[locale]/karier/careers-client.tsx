'use client';

import { useEffect, useState } from 'react';

interface Opening {
  id: string;
  title: string;
  department: string | null;
  summary: string | null;
  requirements: string | null;
  benefits: string | null;
  headcount: number;
  closeDate: string | null;
}

export function CareersClient() {
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeOpening, setActiveOpening] = useState<Opening | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/careers/openings')
      .then((r) => r.json())
      .then((data: { openings?: Opening[] }) => {
        if (cancelled) return;
        setOpenings(data.openings ?? []);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Gagal memuat daftar lowongan.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitApplication() {
    if (!activeOpening || !form.name.trim()) {
      setError('Isi nama dulu, ya.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/careers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingId: activeOpening.id, ...form }),
      });
      const data: { ok?: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Gagal mengirim aplikasi.');
        return;
      }
      setSubmitted(activeOpening.title);
      setForm({ name: '', email: '', phone: '', notes: '' });
      setActiveOpening(null);
    } catch {
      setError('Gangguan jaringan. Coba lagi sebentar.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-brand-ink-3">Memuat lowongan…</p>;
  if (openings.length === 0)
    return (
      <p className="rounded-lg border border-brand-cream-3 bg-card p-6 text-sm text-brand-ink-2">
        Belum ada lowongan terbuka. Tetap pantau halaman ini, ya — kami sering membuka lowongan
        barista, kasir, dan back office.
      </p>
    );

  return (
    <div className="space-y-4">
      {submitted ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Terima kasih! Aplikasi untuk <b>{submitted}</b> sudah masuk. Tim HR akan menghubungi via
          email/WhatsApp.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <ul className="space-y-3">
        {openings.map((o) => (
          <li key={o.id} className="rounded-xl border border-brand-cream-3 bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-brand-ink">{o.title}</h2>
                <p className="text-xs uppercase tracking-widest text-brand-ink-3">
                  {o.department ?? 'Operasional'} · {o.headcount} posisi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveOpening((cur) => (cur?.id === o.id ? null : o))}
                className="rounded-full bg-brand-red px-4 py-1.5 text-xs font-bold text-brand-cream hover:bg-brand-red-dark"
              >
                {activeOpening?.id === o.id ? 'Tutup form' : 'Daftar'}
              </button>
            </div>
            {o.summary ? (
              <p className="mt-3 text-sm leading-6 text-brand-ink-2">{o.summary}</p>
            ) : null}
            {o.requirements ? (
              <div className="mt-3 rounded-md bg-brand-cream-1 px-3 py-2 text-sm text-brand-ink-2 whitespace-pre-line">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-ink-3">
                  Persyaratan
                </p>
                <p className="mt-1">{o.requirements}</p>
              </div>
            ) : null}
            {activeOpening?.id === o.id ? (
              <form
                className="mt-4 grid gap-3 md:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitApplication();
                }}
              >
                <input
                  required
                  placeholder="Nama lengkap"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm"
                />
                <input
                  placeholder="WhatsApp (08…)"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm md:col-span-2"
                />
                <textarea
                  placeholder="Pengalaman / link CV / pesan singkat"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  className="rounded-md border border-brand-cream-3 bg-card px-3 py-2 text-sm md:col-span-2"
                />
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-full bg-brand-red px-5 py-2 text-sm font-bold text-brand-cream hover:bg-brand-red-dark disabled:opacity-60"
                  >
                    {submitting ? 'Mengirim…' : 'Kirim lamaran'}
                  </button>
                </div>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
