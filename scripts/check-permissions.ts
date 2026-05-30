import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

// Load valid permissions from packages/db/seed/iam.ts
const permissionsFile = path.join(projectRoot, 'packages/db/seed/iam.ts');
const permissionsContent = fs.readFileSync(permissionsFile, 'utf-8');

const validPermissions = new Set<string>();
const permRegex = /code:\s*['"]([^'"]+)['"]/g;
let match;
while ((match = permRegex.exec(permissionsContent)) !== null) {
  validPermissions.add(match[1]);
}

// Add global wildcard
validPermissions.add('*.*');

console.log(`Loaded ${validPermissions.size} valid permissions.`);

function walk(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!filePath.includes('node_modules') && !filePath.includes('.next') && !filePath.includes('.git') && !filePath.includes('dist')) {
        walk(filePath, fileList);
      }
    } else {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const allFiles = walk(projectRoot);
let hasError = false;

// Matches requirePermission(..., 'permission') or can(..., 'permission')
const usageRegex = /(?:requirePermission|can|hasPermission)\s*\(\s*[^,]+,\s*(['"])([^'"]+)\1/g;
// Also check for something like PermissionCode = 'permission'
const typeRegex = /(?:PermissionCode|permission)\s*[:=]\s*(['"])([^'"]+)\1/g;

for (const file of allFiles) {
  if (file === permissionsFile) continue;
  if (file.includes('check-permissions.ts')) continue;
  
  const content = fs.readFileSync(file, 'utf-8');
  let match;
  while ((match = usageRegex.exec(content)) !== null) {
    const usedPerm = match[2];
    if (!validPermissions.has(usedPerm)) {
      console.error(`❌ INVALID PERMISSION: '${usedPerm}' used in ${path.relative(projectRoot, file)}`);
      hasError = true;
    }
  }
}

if (!hasError) {
  console.log('✅ All permission checks passed! No mismatches found.');
} else {
  process.exit(1);
}
