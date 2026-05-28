const fs = require('fs');
const path = require('path');

const targetFiles = [
  'apps/web/app/(dash)/accounting/journals/new/journal-form.tsx',
  'apps/web/app/(dash)/settings/accounting/client.tsx',
  'apps/web/app/(dash)/settings/company/client.tsx',
];

targetFiles.forEach(f => {
  let content = fs.readFileSync(f, 'utf-8');
  if (!content.includes('toast.success')) {
    const lines = content.split('\n');
    let modified = false;
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].includes('router.refresh()') || (lines[i].includes('setOpen(false)') && lines[i-1].includes('await '))) {
         // insert before
         lines.splice(i, 0, `      toast.success('Berhasil disimpan');`);
         modified = true;
         break;
      }
    }
    if (modified) {
       let newContent = lines.join('\n');
       if (!newContent.includes('import { toast }') && !newContent.includes('toast,')) {
         if (newContent.includes(`from '@erp/ui'`)) {
            newContent = newContent.replace(`from '@erp/ui'`, `, toast } from '@erp/ui'`).replace(`import { `, `import { toast, `).replace('toast, toast', 'toast');
         } else {
            lines.splice(1, 0, `import { toast } from '@erp/ui';`);
            newContent = lines.join('\n');
         }
       }
       fs.writeFileSync(f, newContent, 'utf-8');
       console.log('Modified', f);
    }
  }
});
