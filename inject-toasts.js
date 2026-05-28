const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('apps/web/app/(dash)');

let modifiedCount = 0;

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf-8');
  if (content.includes('router.push(') && (f.includes('form') || f.includes('client'))) {
    // Check if it already has toast
    if (!content.includes('toast.success')) {
      // Find `await someAction(...); \n router.push(` or similar
      const lines = content.split('\n');
      let modified = false;
      
      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].includes('await ') && lines[i+1].includes('router.push(')) {
          lines.splice(i+1, 0, `      toast.success(t('success') || 'Berhasil disimpan');`);
          modified = true;
          break; // only do it once per file for simplicity
        } else if (lines[i].includes('await ') && lines[i+1].includes('router.refresh()') && lines[i+2].includes('router.push(')) {
          lines.splice(i+1, 0, `      toast.success(t('success') || 'Berhasil disimpan');`);
          modified = true;
          break;
        }
      }
      
      if (modified) {
        let newContent = lines.join('\n');
        // Ensure toast is imported
        if (!newContent.includes('import { toast }') && !newContent.includes('toast,')) {
           if (newContent.includes(`from '@erp/ui'`)) {
              newContent = newContent.replace(`from '@erp/ui'`, `, toast } from '@erp/ui'`).replace(`import { `, `import { toast, `).replace('toast, toast', 'toast');
           } else {
              const lastImportIndex = lines.findIndex(l => !l.startsWith('import '));
              lines.splice(1, 0, `import { toast } from '@erp/ui';`);
              newContent = lines.join('\n');
           }
        }
        fs.writeFileSync(f, newContent, 'utf-8');
        modifiedCount++;
        console.log('Added toast to', f);
      }
    }
  }
});

console.log('Modified', modifiedCount, 'files');
