const fs = require('fs');
const file = 'apps/web/app/(dash)/accounting/bank-recon/actions.ts';
if (fs.existsSync(file)) {
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
    return \equirePermission(\, \ as PermissionCode\\;
  });
  if (changed) {
    fs.writeFileSync(file, content);
  }
}
console.log('Fixed bank recon');
