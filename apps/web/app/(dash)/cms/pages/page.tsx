import { getSession } from '@/lib/auth';
/**
 * CMS Pages — List page (SD §31.3)
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchCmsPages } from '../actions';

export const metadata: Metadata = { title: 'Pages — CMS' };

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-brand-cream-2 text-brand-ink-3',
  review: 'bg-brand-gold/10 text-brand-gold',
  published: 'bg-brand-jade/10 text-brand-jade',
  archived: 'bg-brand-ink/5 text-brand-ink-3',
};

const TYPE_LABELS: Record<string, string> = {
  page: 'Halaman',
  landing: 'Landing',
  legal: 'Hukum',
};

/**
 * Static (file-system based) routes on the public website. The CMS cannot
 * edit them — they live as page.tsx files under apps/site/app/[locale]/.
 * Listed here so admins are aware they exist alongside DB-driven content.
 */
const STATIC_ROUTES: Array<{ slug: string; label: string; description: string }> = [
  { slug: '/', label: 'Beranda', description: 'Landing page utama (file-based).' },
  { slug: '/menu', label: 'Menu', description: 'Daftar menu publik.' },
  { slug: '/tentang', label: 'Tentang', description: 'Profil perusahaan & cerita brand.' },
  { slug: '/lokasi', label: 'Lokasi', description: 'Daftar outlet & alamat.' },
  { slug: '/blog', label: 'Blog', description: 'Index posting blog (post dinamis).' },
  { slug: '/member', label: 'Member', description: 'Area member (login, registrasi, akun).' },
  {
    slug: '/karier',
    label: 'Karier',
    description: 'Daftar lowongan + form lamaran (real-time dari ERP).',
  },
  {
    slug: '/syarat-dan-ketentuan',
    label: 'Syarat & Ketentuan',
    description: 'Halaman legal — kontennya editable via CMS Halaman.',
  },
  {
    slug: '/kebijakan-privasi',
    label: 'Kebijakan Privasi',
    description: 'Halaman legal — kontennya editable via CMS Halaman.',
  },
];

export default async function CmsPagesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const pages = await fetchCmsPages();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Halaman</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            Kelola halaman statis situs (beranda, tentang, menu, dll.)
          </p>
        </div>
        <Link
          href="/cms/pages/new"
          className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-red/90"
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
          Buat Halaman
        </Link>
      </div>

      {/* File-based routes (not editable from CMS) */}
      <div className="rounded-lg border border-brand-cream-3 bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-ink">Halaman bawaan (file-based)</p>
            <p className="text-xs text-brand-ink-3">
              Rute publik yang sudah aktif. Konten halaman legal di bawah ini bisa diubah dari tabel
              CMS Halaman (slug yang sama akan menimpa konten default).
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-cream-3 text-left text-xs uppercase tracking-wider text-brand-ink-3">
                <th className="py-2 pr-3">Slug</th>
                <th className="py-2 pr-3">Halaman</th>
                <th className="py-2 pr-3">Keterangan</th>
                <th className="py-2 pr-3">Pratinjau</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3">
              {STATIC_ROUTES.map((route) => (
                <tr key={route.slug}>
                  <td className="py-2 pr-3">
                    <code className="rounded bg-brand-cream-2 px-1.5 py-0.5 text-xs font-mono text-brand-ink-2">
                      {route.slug}
                    </code>
                  </td>
                  <td className="py-2 pr-3 font-medium text-brand-ink">{route.label}</td>
                  <td className="py-2 pr-3 text-brand-ink-3">{route.description}</td>
                  <td className="py-2 pr-3">
                    <a
                      href={`https://aroadritea.com${route.slug === '/' ? '' : route.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-brand-red hover:underline"
                    >
                      Buka
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pages table */}
      <div className="rounded-lg border border-brand-cream-3 bg-card">
        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg
              className="h-12 w-12 text-brand-cream-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-brand-ink-2">Belum ada halaman</p>
            <p className="mt-1 text-xs text-brand-ink-3">Buat halaman pertama untuk situs Anda.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-cream-3 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-brand-ink-3">
                  Judul (ID)
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-brand-ink-3">
                  Slug
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-brand-ink-3">
                  Tipe
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-brand-ink-3">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-brand-ink-3">
                  Navbar
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-brand-ink-3">
                  Diperbarui
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3">
              {pages.map((page: Record<string, unknown>) => {
                const title =
                  (page.title as Record<string, string>)?.id ??
                  (page.title as Record<string, string>)?.en ??
                  '—';
                return (
                  <tr key={page.id as string} className="hover:bg-brand-cream-1/50">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-brand-ink">{title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-brand-cream-2 px-1.5 py-0.5 text-xs font-mono text-brand-ink-2">
                        {(page.slug as string) ?? '—'}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-brand-cream-2 px-2 py-0.5 text-xs font-medium text-brand-ink-2">
                        {TYPE_LABELS[(page.type as string) ?? 'page'] ?? (page.type as string)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[(page.status as string) ?? 'draft']}`}
                      >
                        {(page.status as string)?.charAt(0).toUpperCase() +
                          ((page.status as string) ?? '').slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(page.isInNavbar as boolean) ? (
                        <svg
                          className="h-4 w-4 text-brand-jade"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m4.5 12.75 6 6 9-13.5"
                          />
                        </svg>
                      ) : (
                        <span className="text-brand-cream-3">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-brand-ink-3">
                        {page.updatedAt
                          ? new Date(page.updatedAt as string).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/cms/pages/${page.id as string}`}
                          className="rounded-md p-1.5 text-brand-ink-3 hover:bg-brand-cream-2 hover:text-brand-ink"
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
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
