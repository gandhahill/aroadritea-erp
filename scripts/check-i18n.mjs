import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const webRoot = path.join(repoRoot, 'apps', 'web');
const msgDir = path.join(webRoot, 'messages');

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = true;
  }
  return out;
}

const en = flatten(JSON.parse(fs.readFileSync(path.join(msgDir, 'en.json'), 'utf8')));
const id = flatten(JSON.parse(fs.readFileSync(path.join(msgDir, 'id.json'), 'utf8')));
const zh = flatten(JSON.parse(fs.readFileSync(path.join(msgDir, 'zh.json'), 'utf8')));

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'messages'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, files);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
  return files;
}

const files = walk(webRoot);

const missing = [];
let dynamicSkipped = 0;
let callsChecked = 0;

const reNs =
  /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)?\s*\)/g;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const nsByVar = {};
  let m;
  reNs.lastIndex = 0;
  while ((m = reNs.exec(src))) {
    const ns = m[2] ?? m[3] ?? m[4] ?? '';
    (nsByVar[m[1]] ??= []).push(ns); // a var may be (re)bound to several namespaces in one file
  }
  for (const [v, nsList] of Object.entries(nsByVar)) {
    // match  v('key')  or  v.rich('key')  or  v.has('key')
    const reCall = new RegExp(`\\b${v}(?:\\.(?:rich|has|markup))?\\s*\\(\\s*(['"\\\`])([^'"\\\`]*?)\\1`, 'g');
    let c;
    while ((c = reCall.exec(src))) {
      const quote = c[1];
      const key = c[2];
      if (quote === '`' && key.includes('${')) {
        dynamicSkipped++;
        continue;
      }
      // skip obvious dynamic fragments (concatenation): key ends with '.' or is empty
      if (key === '' || key.endsWith('.')) {
        dynamicSkipped++;
        continue;
      }
      callsChecked++;
      // Pass if the key resolves under ANY namespace this var was bound to in the file.
      const candidates = nsList.map((ns) => (ns ? `${ns}.${key}` : key));
      const resolves = candidates.some((full) => en[full] && id[full] && zh[full]);
      if (!resolves) {
        const full = candidates[0];
        missing.push({ file: path.relative(webRoot, file), key: full, en: !!en[full], id: !!id[full], zh: !!zh[full] });
      }
    }
  }
}

console.log(`Scanned ${files.length} files in apps/web.`);
console.log(`Keys: en=${Object.keys(en).length} id=${Object.keys(id).length} zh=${Object.keys(zh).length}`);
console.log(`t() calls checked: ${callsChecked}  (dynamic/skipped: ${dynamicSkipped})`);

// dedupe missing
const seen = new Set();
const uniqMissing = missing.filter((x) => {
  const k = x.key + x.file;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

if (uniqMissing.length === 0) {
  console.log('\n✅ NO missing i18n key references — every static t() key resolves in en+id+zh.');
} else {
  console.log(`\n❌ ${uniqMissing.length} missing key reference(s):`);
  for (const x of uniqMissing) console.log(`   ${x.key}   [en:${x.en} id:${x.id} zh:${x.zh}]   ${x.file}`);
}

// Locale parity (key set equality)
const allKeys = new Set([...Object.keys(en), ...Object.keys(id), ...Object.keys(zh)]);
const parityGaps = [];
for (const k of allKeys) if (!en[k] || !id[k] || !zh[k]) parityGaps.push(k);

if (uniqMissing.length > 0 || parityGaps.length > 0) {
  process.exitCode = 1;
}

if (parityGaps.length === 0) {
  console.log('✅ Locale parity OK — en, id, zh have identical key sets.');
} else {
  console.log(`\n❌ ${parityGaps.length} locale parity gap(s):`);
  for (const k of parityGaps.slice(0, 80)) console.log(`   ${k}   [en:${!!en[k]} id:${!!id[k]} zh:${!!zh[k]}]`);
}
