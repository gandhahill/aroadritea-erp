'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createCategoryAction, deleteCategoryAction } from './actions';

interface CategoryItem {
  id: string;
  name: unknown;
  sortOrder: number;
}

export function CategoriesClient({ categories }: { categories: CategoryItem[] }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setIsCreating(true);
      await createCategoryAction(newName);
      setNewName('');
      router.refresh();
    } catch (err) {
      alert('Gagal membuat kategori');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus kategori ini?')) return;
    try {
      await deleteCategoryAction(id);
      router.refresh();
    } catch (err) {
      alert('Gagal menghapus kategori');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="flex items-center gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nama Kategori Baru"
          className="rounded-lg border border-brand-cream-3 px-3 py-2 text-sm focus:border-brand-red focus:outline-none"
        />
        <button
          type="submit"
          disabled={isCreating || !newName.trim()}
          className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
        >
          {isCreating ? 'Menyimpan...' : 'Tambah Kategori'}
        </button>
      </form>

      <div className="surface-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-cream-2 bg-brand-cream/50">
              <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Nama Kategori</th>
              <th className="px-4 py-3 text-right font-medium text-brand-ink-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-2">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-brand-ink-3">
                  Belum ada kategori.
                </td>
              </tr>
            ) : (
              categories.map((cat) => {
                const nameObj = cat.name as { id?: string; en?: string } | null;
                const display = nameObj?.id ?? nameObj?.en ?? 'Tanpa Nama';
                return (
                  <tr key={cat.id} className="hover:bg-brand-cream/50">
                    <td className="px-4 py-3 font-medium text-brand-ink">{display}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="text-brand-red hover:underline text-xs"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
