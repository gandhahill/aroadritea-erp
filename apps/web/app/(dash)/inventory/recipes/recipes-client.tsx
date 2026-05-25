'use client';

import { formatQty } from '@/lib/format-qty';
import { Input, Select, TableBody, TableHeader } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import {
  type ProductOption,
  type RecipeLineRow,
  type RecipeRow,
  addRecipeLineAction,
  createRecipeAction,
  deleteRecipeAction,
  deleteRecipeLineAction,
  fetchRecipeLines,
} from './actions';

interface Props {
  initial: {
    recipes: RecipeRow[];
    finishedGoods: ProductOption[];
    ingredients: ProductOption[];
  };
}

export function RecipesClient({ initial }: Props) {
  const t = useTranslations('inventory.recipes');
  const tc = useTranslations('common.labels');
  const [recipes, setRecipes] = useState(initial.recipes);
  const [selectedBomId, setSelectedBomId] = useState<string | null>(
    initial.recipes[0]?.bomId ?? null,
  );
  const [linesByBom, setLinesByBom] = useState<Record<string, RecipeLineRow[]>>({});
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [newRecipe, setNewRecipe] = useState({ productId: '', description: '' });

  const [newLine, setNewLine] = useState({
    ingredientId: '',
    qty: '',
    uom: '',
    isOptional: false,
    autoDeduct: true,
  });

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return recipes;
    return recipes.filter(
      (r) =>
        r.productSku.toLowerCase().includes(ql) ||
        r.productName.toLowerCase().includes(ql) ||
        (r.description ?? '').toLowerCase().includes(ql),
    );
  }, [recipes, q]);

  const selectedLines = selectedBomId ? linesByBom[selectedBomId] : undefined;

  function selectRecipe(bomId: string) {
    setSelectedBomId(bomId);
    if (!linesByBom[bomId]) {
      startTransition(async () => {
        const rows = await fetchRecipeLines(bomId);
        setLinesByBom((prev) => ({ ...prev, [bomId]: rows }));
      });
    }
  }

  function submitNewRecipe() {
    setErr(null);
    if (!newRecipe.productId) {
      setErr(t('errors.selectProduct'));
      return;
    }
    startTransition(async () => {
      const res = await createRecipeAction(newRecipe);
      if (!res.ok || !res.id) {
        setErr(res.error ?? t('errors.createFailed'));
        return;
      }
      const bomId = res.id;
      const product = initial.finishedGoods.find((p) => p.id === newRecipe.productId);
      setRecipes((prev) => [
        {
          bomId,
          productId: newRecipe.productId,
          productSku: product?.sku ?? '—',
          productName: product?.name ?? '—',
          variantId: null,
          description: newRecipe.description || null,
          lineCount: 0,
          isActive: true,
        },
        ...prev,
      ]);
      setSelectedBomId(bomId);
      setLinesByBom((prev) => ({ ...prev, [bomId]: [] }));
      setShowNew(false);
      setNewRecipe({ productId: '', description: '' });
    });
  }

  function submitNewLine() {
    if (!selectedBomId) return;
    setErr(null);
    const qtyNum = Number.parseFloat(newLine.qty);
    if (!newLine.ingredientId || !Number.isFinite(qtyNum) || qtyNum <= 0) {
      setErr(t('errors.selectIngredient'));
      return;
    }
    startTransition(async () => {
      const ingredient = initial.ingredients.find((i) => i.id === newLine.ingredientId);
      const res = await addRecipeLineAction({
        bomId: selectedBomId,
        ingredientId: newLine.ingredientId,
        qty: newLine.qty,
        uom: newLine.uom || ingredient?.uom || 'pcs',
        isOptional: newLine.isOptional,
        autoDeduct: newLine.autoDeduct,
      });
      if (!res.ok) {
        setErr(res.error ?? t('errors.addFailed'));
        return;
      }
      const rows = await fetchRecipeLines(selectedBomId);
      setLinesByBom((prev) => ({ ...prev, [selectedBomId]: rows }));
      setRecipes((prev) =>
        prev.map((r) => (r.bomId === selectedBomId ? { ...r, lineCount: rows.length } : r)),
      );
      setNewLine({ ingredientId: '', qty: '', uom: '', isOptional: false, autoDeduct: true });
    });
  }

  function removeLine(lineId: string) {
    if (!selectedBomId) return;
    setErr(null);
    startTransition(async () => {
      const res = await deleteRecipeLineAction(lineId);
      if (!res.ok) {
        setErr(res.error ?? t('errors.deleteLineFailed'));
        return;
      }
      const rows = await fetchRecipeLines(selectedBomId);
      setLinesByBom((prev) => ({ ...prev, [selectedBomId]: rows }));
      setRecipes((prev) =>
        prev.map((r) => (r.bomId === selectedBomId ? { ...r, lineCount: rows.length } : r)),
      );
    });
  }

  function removeRecipe(bomId: string) {
    setErr(null);
    startTransition(async () => {
      const res = await deleteRecipeAction(bomId);
      if (!res.ok) {
        setErr(res.error ?? t('errors.deleteFailed'));
        return;
      }
      setRecipes((prev) => prev.filter((r) => r.bomId !== bomId));
      if (selectedBomId === bomId) setSelectedBomId(null);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1.8fr]">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')}
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="shrink-0 rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark"
          >
            {showNew ? t('cancel') : t('newRecipe')}
          </button>
        </div>

        {err ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {err}
          </div>
        ) : null}

        {showNew ? (
          <div className="space-y-2 rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-3">
            <Select
              value={newRecipe.productId}
              onChange={(e) => setNewRecipe((p) => ({ ...p, productId: e.target.value }))}
            >
              <option value="">{t('selectProduct')}</option>
              {initial.finishedGoods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </Select>
            <Input
              value={newRecipe.description}
              onChange={(e) => setNewRecipe((p) => ({ ...p, description: e.target.value }))}
              placeholder={t('notePlaceholder')}
            />
            <button
              type="button"
              onClick={submitNewRecipe}
              disabled={busy}
              className="w-full rounded-md bg-brand-red px-3 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
            >
              {busy ? t('saving') : t('createRecipe')}
            </button>
          </div>
        ) : null}

        <ul className="max-h-[60vh] overflow-y-auto rounded-lg border border-brand-cream-3 bg-card">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-brand-ink-3">
              {recipes.length === 0 ? t('noRecipes') : t('notFound')}
            </li>
          ) : (
            filtered.map((r) => (
              <li key={r.bomId} className="border-b border-brand-cream-3 last:border-0">
                <button
                  type="button"
                  onClick={() => selectRecipe(r.bomId)}
                  className={`w-full px-3 py-2 text-left text-sm ${
                    selectedBomId === r.bomId ? 'bg-brand-red/5' : 'hover:bg-brand-cream-1'
                  }`}
                >
                  <p className="font-medium text-brand-ink">{r.productName}</p>
                  <p className="text-[11px] text-brand-ink-3">
                    {r.productSku} · {r.lineCount} {t('ingredientsList')}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-3">
        {selectedBomId ? (
          <div className="rounded-xl border border-brand-cream-3 bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-brand-ink">{t('recipeIngredients')}</h2>
              <button
                type="button"
                onClick={() => removeRecipe(selectedBomId)}
                className="text-xs text-brand-ink-3 hover:text-brand-red"
              >
                {t('deleteRecipe')}
              </button>
            </div>

            <div className="mb-3 grid gap-2 rounded-lg border border-brand-cream-3 bg-brand-cream-1 p-3 md:grid-cols-[1.5fr_0.8fr_0.6fr_auto]">
              <Select
                value={newLine.ingredientId}
                onChange={(e) => {
                  const ing = initial.ingredients.find((i) => i.id === e.target.value);
                  setNewLine((p) => ({
                    ...p,
                    ingredientId: e.target.value,
                    uom: ing?.uom ?? p.uom,
                  }));
                }}
              >
                <option value="">{t('selectIngredient')}</option>
                {initial.ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.sku} — {i.name} ({i.uom})
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={newLine.qty}
                onChange={(e) => setNewLine((p) => ({ ...p, qty: e.target.value }))}
                placeholder={t('qty')}
              />
              <Input
                value={newLine.uom}
                onChange={(e) => setNewLine((p) => ({ ...p, uom: e.target.value }))}
                placeholder={t('uom')}
              />
              <button
                type="button"
                onClick={submitNewLine}
                disabled={busy}
                className="rounded-md bg-brand-red px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-dark disabled:opacity-50"
              >
                {t('addIngredient')}
              </button>
              <label className="flex items-center gap-2 text-xs font-medium text-brand-ink-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={newLine.autoDeduct}
                  onChange={(e) => setNewLine((p) => ({ ...p, autoDeduct: e.target.checked }))}
                  className="h-4 w-4 rounded border-brand-cream-3 text-brand-red"
                />
                {t('autoDeductLabel')}
              </label>
            </div>

            <table className="w-full text-sm">
              <TableHeader className="bg-brand-cream-1 text-left text-xs uppercase tracking-wider text-brand-ink-3">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">{t('columns.ingredient')}</th>
                  <th className="px-3 py-2 text-right">{t('columns.qty')}</th>
                  <th className="px-3 py-2">{t('columns.uom')}</th>
                  <th className="px-3 py-2">{t('columns.auto')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </TableHeader>
              <TableBody className="divide-y divide-brand-cream-3">
                {!selectedLines ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-xs text-brand-ink-3">
                      {t('loadingIngredients')}
                    </td>
                  </tr>
                ) : selectedLines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-xs text-brand-ink-3">
                      {t('noIngredients')}
                    </td>
                  </tr>
                ) : (
                  selectedLines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2 text-xs text-brand-ink-3">{l.lineNo}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-brand-ink-3">
                          {l.ingredientSku}
                        </span>{' '}
                        <span className="text-brand-ink">{l.ingredientName}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(l.qty)}</td>
                      <td className="px-3 py-2">{l.uom}</td>
                      <td className="px-3 py-2 text-xs text-brand-ink-3">
                        {l.autoDeduct ? tc('yes') : tc('no')}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(l.id)}
                          className="text-xs text-brand-ink-3 hover:text-brand-red"
                        >
                          {tc('delete')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </TableBody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-brand-cream-3 p-10 text-center text-sm text-brand-ink-3">
            {t('selectRecipePrompt')}
          </div>
        )}
      </section>
    </div>
  );
}
