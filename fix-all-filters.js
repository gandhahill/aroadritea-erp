const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${fullPath} - does not exist.`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;
  
  for (const { search, replace } of replacements) {
    if (content.includes(search)) {
      content = content.replace(search, replace);
    } else {
      console.log(`Search string not found in ${filePath}:\n${search.substring(0, 80)}...`);
    }
  }

  // Ensure imports exist
  if (content !== originalContent) {
    if (!content.includes('import { FilterBar, FilterField }')) {
      if (content.includes('import { PageHeader } from "@/components/page-header";')) {
        content = content.replace('import { PageHeader } from "@/components/page-header";', 'import { PageHeader } from "@/components/page-header";\nimport { FilterBar, FilterField } from "@/components/filter-bar";');
      } else {
        // Fallback for po-filter-table.tsx
        content = content.replace('import { TableCell', 'import { FilterBar, FilterField } from "@/components/filter-bar";\nimport { TableCell');
      }
    }
    
    // Add Input import if missing and needed
    if (content.includes('<Input') && !content.includes('Input } from "@erp/ui"')) {
        content = content.replace('Select } from "@erp/ui"', 'Select, Input } from "@erp/ui"');
    }

    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${filePath}`);
  }
}

// 1. PO Filter Table
replaceInFile('apps/web/app/(dash)/purchasing/po-filter-table.tsx', [
  {
    search: `      <div className="flex flex-wrap items-center gap-2 border-b border-brand-cream-3 px-5 py-3">
        <input
          type="search"
          placeholder={t('searchPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 min-w-40 flex-1 rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-brand-cream-3 bg-card px-2 text-sm"
        >
          <option value="">{t('allStatuses')}</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="partial">Partial</option>
          <option value="received">Received</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label={t('fromDate')}
          className="h-9 rounded-md border border-brand-cream-3 bg-card px-2 text-sm"
        />
        <span className="text-xs text-brand-ink-3">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label={t('toDate')}
          className="h-9 rounded-md border border-brand-cream-3 bg-card px-2 text-sm"
        />
        <span className="ml-auto text-xs text-brand-ink-3">
          {t('filteredCount', { filtered: filtered.length, total: purchaseOrders.length })}
        </span>
      </div>`,
    replace: `      <FilterBar>
        <FilterField>
          <Input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full sm:w-64"
          />
        </FilterField>
        <FilterField>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full sm:w-40"
          >
            <option value="">{t('allStatuses')}</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="partial">Partial</option>
            <option value="received">Received</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </FilterField>
        <FilterField>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label={t('fromDate')}
          />
        </FilterField>
        <span className="text-sm text-brand-ink-3">—</span>
        <FilterField>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label={t('toDate')}
          />
        </FilterField>
        <span className="ml-auto text-xs text-brand-ink-3">
          {t('filteredCount', { filtered: filtered.length, total: purchaseOrders.length })}
        </span>
      </FilterBar>`
  }
]);

console.log("Done.");
