import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', 'apps', 'web');
const idJsonPath = path.join(webRoot, 'messages', 'id.json');
const idJson = JSON.parse(fs.readFileSync(idJsonPath, 'utf8'));

// Helper to get nested value from object
function getNested(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

const missingKeys = new Set();
let totalFound = 0;

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find namespaces: getTranslations('namespace') or useTranslations('namespace')
  const nsRegex = /(?:getTranslations|useTranslations)\(\s*['"]([^'"]+)['"]\s*\)/g;
  let nsMatch;
  const namespaces = [];
  while ((nsMatch = nsRegex.exec(content)) !== null) {
    namespaces.push(nsMatch[1]);
  }

  // If no namespace defined in the file, it might be passed down, but we mainly care about where t() is used
  // Let's assume the first namespace found in the file is the primary one, or we check all of them.
  // Many files use just one namespace.
  
  // Find all t('some.key') or t("some.key")
  const tRegex = /\bt\(\s*['"]([^'"]+)['"]/g;
  let tMatch;
  while ((tMatch = tRegex.exec(content)) !== null) {
    const key = tMatch[1];
    
    // Sometimes keys are dynamic: t(`some.${key}`) -> we skip these for static analysis
    if (key.includes('${')) continue;

    // Check against all namespaces found in this file
    let foundInAnyNs = false;
    
    if (namespaces.length > 0) {
      for (const ns of namespaces) {
        const fullKey = `${ns}.${key}`;
        if (getNested(idJson, fullKey) !== undefined) {
          foundInAnyNs = true;
          break;
        }
      }
      
      if (!foundInAnyNs) {
        // If not found in any namespace, report it for the first namespace
        missingKeys.add(`${namespaces[0]}.${key} (in ${path.relative(webRoot, filePath)})`);
      }
    } else {
       // If no namespace found but `t()` is used, it might be from props.
       // Skip for now, or check globally if it exists at root
       if (getNested(idJson, key) === undefined) {
         missingKeys.add(`ROOT?.${key} (in ${path.relative(webRoot, filePath)})`);
       }
    }
    totalFound++;
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      checkFile(fullPath);
    }
  }
}

walk(path.join(webRoot, 'app'));

console.log(`Scanned ${totalFound} translation keys.`);
if (missingKeys.size > 0) {
  console.log(`\nFound ${missingKeys.size} POTENTIALLY MISSING keys in id.json:`);
  for (const k of missingKeys) {
    console.log(`- ${k}`);
  }
} else {
  console.log('\nAll checked keys appear to exist in id.json!');
}
