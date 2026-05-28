const fs = require('fs');

function processFile(file) {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (!content.includes('import type { PermissionCode }')) {
    content = 'import type { PermissionCode } from \'@erp/shared/types\';\n' + content;
    changed = true;
  }

  const regexRequire = /requirePermission\(([^,]+),\s*([^,)]+)(,|\))/g;
  content = content.replace(regexRequire, (match, p1, p2, p3) => {
    if (p2.includes('as PermissionCode')) return match;
    changed = true;
    return `requirePermission(${p1}, ${p2} as PermissionCode${p3}`;
  });

  const regexCan = /can\(([^,]+),\s*([^,)]+)(,|\))/g;
  content = content.replace(regexCan, (match, p1, p2, p3) => {
    if (p2.includes('as PermissionCode')) return match;
    changed = true;
    return `can(${p1}, ${p2} as PermissionCode${p3}`;
  });
  
  if (changed) {
    fs.writeFileSync(file, content);
  }
}

const files = [
  'apps/web/app/(dash)/accounting/bank-recon/actions.ts',
  'apps/web/app/(dash)/accounting/invoices/actions.ts',
  'apps/web/app/(dash)/accounting/party-ledger-actions.ts',
  'apps/web/app/(dash)/dashboard/page.tsx',
  'apps/web/app/(dash)/docs/page.tsx',
  'apps/web/app/api/uploads/[...key]/route.ts',
  'apps/web/app/api/uploads/route.ts',
  'packages/services/src/ai/tools/registry.ts'
];

for (const f of files) {
  processFile(f);
}
console.log('Fixed web v2');
