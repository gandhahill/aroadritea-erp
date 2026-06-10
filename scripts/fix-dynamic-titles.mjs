import { execSync } from 'child_process';
/**
 * Fix dynamic metadata titles (generateMetadata) to use " | Aroadri ERP" suffix.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'apps', 'web', 'app');

// Find all page.tsx files with generateMetadata
const output = execSync(
  `Get-ChildItem -Path "${root}" -Recurse -Filter "page.tsx" | Select-String "return { title:" | Select-Object -ExpandProperty Path -Unique`,
  { shell: 'powershell.exe', encoding: 'utf-8' },
).trim();

const files = output
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean);

const replacements = [
  // Simple: return { title: t('title') };
  [/return \{ title: t\('title'\) \}/g, "return { title: `${t('title')} | Aroadri ERP` }"],
  // Detail: return { title: t('detail.title') };
  [
    /return \{ title: t\('detail\.title'\) \}/g,
    "return { title: `${t('detail.title')} | Aroadri ERP` }",
  ],
  // CMS pages: return { title: `${t('title')} - CMS` };
  [
    /return \{ title: `\$\{t\('title'\)\} - CMS` \}/g,
    "return { title: `${t('title')} | Aroadri ERP` }",
  ],
  // SOP: return { title: `${t('title')} - Aroadri Tea` };
  [
    /return \{ title: `\$\{t\('title'\)\} - Aroadri Tea` \}/g,
    "return { title: `${t('title')} | Aroadri ERP` }",
  ],
  // CMS edit page: return { title: `Edit Page - ${id.slice(0, 8)}. - CMS` };
  [
    /return \{ title: `Edit Page - \$\{id\.slice\(0, 8\)\}\. - CMS` \}/g,
    'return { title: `Edit Page - ${id.slice(0, 8)} | Aroadri ERP` }',
  ],
  // CMS edit post: return { title: `Edit Post - ${id.slice(0, 8)}. - CMS` };
  [
    /return \{ title: `Edit Post - \$\{id\.slice\(0, 8\)\}\. - CMS` \}/g,
    'return { title: `Edit Post - ${id.slice(0, 8)} | Aroadri ERP` }',
  ],
];

let updated = 0;
for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  for (const [pattern, replacement] of replacements) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }

  // Skip if already has the correct suffix
  if (content.includes('| Aroadri ERP` }') && !changed) continue;

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    const rel = filePath.replace(/^.*?apps/, 'apps');
    console.log(`UPDATED: ${rel}`);
    updated++;
  }
}

console.log(`\nDone! Updated ${updated} dynamic title files.`);
