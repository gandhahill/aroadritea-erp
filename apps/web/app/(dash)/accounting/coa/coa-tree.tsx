/**
 * COA Tree View — client component.
 * Interactive tree with expand/collapse, search filter, type badges.
 * SD §21.1, ADR-0006 (brand tokens, no generic shadcn).
 */

'use client';

import { useMemo, useState } from 'react';
import type { COANode } from './actions';

// --- Type badge config ---
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  asset: { bg: 'bg-brand-jade-light', text: 'text-brand-jade', border: 'border-brand-jade/20' },
  liability: { bg: 'bg-brand-clay-light', text: 'text-brand-clay', border: 'border-brand-clay/20' },
  equity: { bg: 'bg-brand-gold-light', text: 'text-brand-gold', border: 'border-brand-gold/20' },
  income: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  cogs: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  expense: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
};

const TYPE_LABELS: Record<string, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  income: 'Income',
  cogs: 'COGS',
  expense: 'Expense',
};

interface COATreeViewProps {
  tree: COANode[];
}

export function COATreeView({ tree }: COATreeViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Expand all root nodes by default
    return new Set(tree.map((n) => n.id));
  });
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Filter tree by search query
  const filteredTree = useMemo(() => {
    if (!searchQuery && !selectedType) return tree;
    return filterTree(tree, searchQuery.toLowerCase(), selectedType);
  }, [tree, searchQuery, selectedType]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collect = (nodes: COANode[]) => {
      for (const n of nodes) {
        allIds.add(n.id);
        collect(n.children);
      }
    };
    collect(tree);
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const accountTypes = ['asset', 'liability', 'equity', 'income', 'cogs', 'expense'];

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="surface-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 5.65 5.65a7.5 7.5 0 0 0 10.99 10.99z"
              />
            </svg>
            <input
              id="coa-search"
              type="text"
              placeholder="Search by code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-brand-cream-3 bg-brand-cream py-2 pl-9 pr-4 text-sm text-brand-ink placeholder:text-brand-ink-3 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 transition-colors"
            />
          </div>

          {/* Type filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            {accountTypes.map((type) => {
              const colors = TYPE_COLORS[type];
              const isActive = selectedType === type;
              return (
                <button
                  type="button"
                  key={type}
                  onClick={() => setSelectedType(isActive ? null : type)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? `${colors?.bg ?? ''} ${colors?.text ?? ''} ${colors?.border ?? ''} ring-2 ring-offset-1 ring-brand-red/30`
                      : 'border-brand-cream-3 text-brand-ink-3 hover:bg-brand-cream-2'
                  }`}
                >
                  {TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>

          {/* Expand/Collapse */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-md border border-brand-cream-3 px-3 py-1.5 text-xs font-medium text-brand-ink-2 hover:bg-brand-cream-2 transition-colors"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded-md border border-brand-cream-3 px-3 py-1.5 text-xs font-medium text-brand-ink-2 hover:bg-brand-cream-2 transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Tree */}
      <div className="surface-card divide-y divide-brand-cream-2">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
          <div className="col-span-5">Account</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Subtype</div>
          <div className="col-span-1 text-center">Balance</div>
          <div className="col-span-1 text-center">Postable</div>
          <div className="col-span-1 text-center">Status</div>
        </div>

        {/* Tree nodes */}
        {filteredTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-brand-ink-3">
            <svg
              className="mb-3 h-12 w-12 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <p className="text-sm font-medium">No accounts found</p>
            <p className="mt-1 text-xs">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div className="py-1">
            {filteredTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                expandedIds={expandedIds}
                onToggle={toggleExpand}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tree Node ---

interface TreeNodeProps {
  node: COANode;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}

function TreeNode({ node, depth, expandedIds, onToggle }: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const colors = TYPE_COLORS[node.type] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200',
  };

  return (
    <>
      <div
        className={`group grid grid-cols-12 items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-brand-cream/70 ${
          !node.isActive ? 'opacity-50' : ''
        }`}
        style={{ paddingLeft: `${16 + depth * 24}px` }}
      >
        {/* Account code + name */}
        <div className="col-span-5 flex items-center gap-2 min-w-0">
          {/* Expand/collapse toggle */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(node.id)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-brand-ink-3 hover:bg-brand-cream-2 hover:text-brand-ink transition-all"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}

          <span className="shrink-0 font-mono text-xs text-brand-ink-3 tabular-nums">
            {node.code}
          </span>
          <span className="truncate font-medium text-brand-ink">
            {node.name.id ?? node.name.en ?? Object.values(node.name)[0]}
          </span>
        </div>

        {/* Type */}
        <div className="col-span-2">
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors.bg} ${colors.text} ${colors.border}`}
          >
            {TYPE_LABELS[node.type] ?? node.type}
          </span>
        </div>

        {/* Subtype */}
        <div className="col-span-2 text-xs text-brand-ink-3 capitalize">
          {node.subtype.replace(/_/g, ' ')}
        </div>

        {/* Normal balance */}
        <div className="col-span-1 text-center">
          <span
            className={`text-xs font-medium ${node.normalBalance === 'debit' ? 'text-brand-jade' : 'text-brand-clay'}`}
          >
            {node.normalBalance === 'debit' ? 'DR' : 'CR'}
          </span>
        </div>

        {/* Postable */}
        <div className="col-span-1 text-center">
          {node.isPostable ? (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-jade-light text-brand-jade">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          ) : (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-cream-3 text-brand-ink-3">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          )}
        </div>

        {/* Status */}
        <div className="col-span-1 text-center">
          {node.isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-jade-light px-2 py-0.5 text-[10px] font-medium text-brand-jade">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-jade" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-cream-3 px-2 py-0.5 text-[10px] font-medium text-brand-ink-3">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-ink-3" />
              Inactive
            </span>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </>
  );
}

// --- Filter helper ---

function filterTree(nodes: COANode[], query: string, typeFilter: string | null): COANode[] {
  return nodes
    .map((node) => {
      const filteredChildren = filterTree(node.children, query, typeFilter);

      const matchesQuery =
        !query ||
        node.code.toLowerCase().includes(query) ||
        Object.values(node.name).some((v) => v.toLowerCase().includes(query));

      const matchesType = !typeFilter || node.type === typeFilter;

      // Include if self matches OR has matching children
      if ((matchesQuery && matchesType) || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }

      return null;
    })
    .filter(Boolean) as COANode[];
}
