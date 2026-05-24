'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { TableCell, TableBody, TableHead, Select, Input } from "@erp/ui";
import { FilterBar, FilterField } from '@/components/filter-bar';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-brand-cream-2 text-brand-ink-3',
  review: 'bg-brand-gold/10 text-brand-gold',
  published: 'bg-brand-jade/10 text-brand-jade',
  archived: 'bg-brand-ink/5 text-brand-ink-3',
};

const KIND_LABELS: Record<string, string> = {
  news: 'Berita',
  promo: 'Promo',
  recipe: 'Resep',
  event: 'Event',
};

export interface PostRow {
  id: string;
  title: Record<string, string> | null;
  slug: string;
  kind: string;
  status: string;
  tags: string[];
  updatedAt: string | null;
}

interface Props {
  posts: PostRow[];
}

export function PostsTableClient({ posts }: Props) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return posts.filter((p) => {
      if (kind && p.kind !== kind) return false;
      if (status && p.status !== status) return false;
      if (!ql) return true;
      const title = p.title?.id ?? p.title?.en ?? p.title?.zh ?? '';
      return (
        title.toLowerCase().includes(ql) ||
        p.slug.toLowerCase().includes(ql) ||
        p.tags.some((t) => t.toLowerCase().includes(ql))
      );
    });
  }, [posts, q, kind, status]);

  return (
    <div className="space-y-3">
      <FilterBar>
        <FilterField>
          <Input
            type="search"
            placeholder="Cari judul, slug, atau tag…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 w-full sm:w-64"
          />
        </FilterField>
        <FilterField>
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-9 w-full sm:w-36"
          >
            <option value="">Semua kategori</option>
            <option value="news">Berita</option>
            <option value="promo">Promo</option>
            <option value="recipe">Resep</option>
            <option value="event">Event</option>
          </Select>
        </FilterField>
        <FilterField>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 w-full sm:w-36"
          >
            <option value="">Semua status</option>
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </FilterField>
        
        <div className="ml-auto flex items-center text-xs text-brand-ink-3">
          {filtered.length} dari {posts.length}
        </div>
      </FilterBar>

      <div className="rounded-lg border border-brand-cream-3 bg-card">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-brand-ink-3">
            {posts.length === 0 ? 'Belum ada post.' : 'Tidak ada post yang cocok dengan filter.'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-cream-3 text-left">
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-brand-ink-3">
                  Judul
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-brand-ink-3">
                  Kategori
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-brand-ink-3">
                  Slug
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-brand-ink-3">
                  Status
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-brand-ink-3">
                  Tag
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-brand-ink-3">
                  Diperbarui
                </TableHead>
                <TableHead className="px-4 py-3" />
              </tr>
            </thead>
            <TableBody className="divide-y divide-brand-cream-3">
              {filtered.map((post) => {
                const title = post.title?.id ?? post.title?.en ?? '—';
                return (
                  <tr key={post.id} className="hover:bg-brand-cream-1/50">
                    <TableCell className="px-4 py-3">
                      <span className="text-sm font-medium text-brand-ink">{title}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="rounded bg-brand-cream-2 px-2 py-0.5 text-xs font-medium text-brand-ink-2">
                        {KIND_LABELS[post.kind] ?? post.kind}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <code className="rounded bg-brand-cream-2 px-1.5 py-0.5 text-xs font-mono text-brand-ink-2">
                        /blog/{post.slug || '—'}
                      </code>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[post.status] ?? 'bg-brand-cream-2 text-brand-ink-3'}`}
                      >
                        {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {post.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-brand-cream-1 px-1.5 py-0.5 text-xs text-brand-ink-3"
                          >
                            {tag}
                          </span>
                        ))}
                        {post.tags.length > 2 ? (
                          <span className="text-xs text-brand-ink-3">+{post.tags.length - 2}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="text-sm text-brand-ink-3">
                        {post.updatedAt
                          ? new Date(post.updatedAt).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Link
                        href={`/cms/posts/${post.id}`}
                        className="rounded-md p-1.5 text-brand-ink-3 hover:bg-brand-cream-2 hover:text-brand-ink"
                        aria-label="Edit"
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
                    </TableCell>
                  </tr>
                );
              })}
            </TableBody>
          </table>
        )}
      </div>
    </div>
  );
}
