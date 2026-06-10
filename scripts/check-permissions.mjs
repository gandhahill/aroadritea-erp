import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

const permissionsFile = path.join(projectRoot, 'packages/db/seed/iam.ts');
const permissionsContent = fs.readFileSync(permissionsFile, 'utf-8');

const validPermissions = new Set();
const permRegex = /code:\s*['"]([^'"]+)['"]/g;
let permissionMatch;
while ((permissionMatch = permRegex.exec(permissionsContent)) !== null) {
  validPermissions.add(permissionMatch[1]);
}

validPermissions.add('*.*');

console.log(`Loaded ${validPermissions.size} valid permissions.`);

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (
        !filePath.includes('node_modules') &&
        !filePath.includes('.next') &&
        !filePath.includes('.git') &&
        !filePath.includes('dist')
      ) {
        walk(filePath, fileList);
      }
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function sourceFiles() {
  try {
    const output = execFileSync('git', ['ls-files', '*.ts', '*.tsx'], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((file) => path.join(projectRoot, file));
  } catch {
    return walk(projectRoot);
  }
}

const allFiles = sourceFiles();
let hasError = false;

const usageRegex = /(?:requirePermission|can|hasPermission)\s*\(\s*[^,]+,\s*(['"])([^'"]+)\1/g;

for (const file of allFiles) {
  const relativeFile = path.relative(projectRoot, file).replaceAll(path.sep, '/');
  if (file === permissionsFile) continue;
  if (relativeFile === 'scripts/check-permissions.ts') continue;
  if (
    relativeFile.startsWith('node_modules/') ||
    relativeFile.startsWith('.next/') ||
    relativeFile.startsWith('dist/')
  ) {
    continue;
  }

  const content = fs.readFileSync(file, 'utf-8');
  usageRegex.lastIndex = 0;
  let usageMatch;
  while ((usageMatch = usageRegex.exec(content)) !== null) {
    const usedPerm = usageMatch[2];
    if (!validPermissions.has(usedPerm)) {
      console.error(`INVALID PERMISSION: '${usedPerm}' used in ${relativeFile}`);
      hasError = true;
    }
  }
}

if (!hasError) {
  console.log('All permission checks passed. No mismatches found.');
} else {
  process.exit(1);
}
