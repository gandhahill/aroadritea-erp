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
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf-8');
  if (content.includes("import { toast, useState } from 'react';")) {
    content = content.replace("import { toast, useState } from 'react';", "import { useState } from 'react';\nimport { toast } from '@erp/ui';");
    fs.writeFileSync(f, content);
    console.log('Fixed', f);
  } else if (content.includes("import { toast, ") && !content.includes("@erp/ui")) {
    content = content.replace("import { toast, ", "import { ");
    content = `import { toast } from '@erp/ui';\n` + content;
    fs.writeFileSync(f, content);
    console.log('Fixed', f);
  } else if (content.includes('import { toast } from "@/lib/pick-localized";')) {
    content = content.replace('import { toast } from "@/lib/pick-localized";', 'import { pickLocalized } from "@/lib/pick-localized";\nimport { toast } from "@erp/ui";');
    fs.writeFileSync(f, content);
  }
});
