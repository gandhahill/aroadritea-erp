import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appName = process.argv[2];

if (!appName) {
  console.error('Usage: node scripts/sync-next-standalone-assets.mjs <app-name>');
  process.exit(1);
}

const appDir = path.join(repoRoot, 'apps', appName);
const standaloneAppDir = path.join(appDir, '.next', 'standalone', 'apps', appName);

if (!existsSync(standaloneAppDir)) {
  console.error(`Standalone app directory not found: ${standaloneAppDir}`);
  process.exit(1);
}

function copyDir(source, destination) {
  if (!existsSync(source)) return;
  rmSync(destination, { force: true, recursive: true });
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

copyDir(path.join(appDir, 'public'), path.join(standaloneAppDir, 'public'));
copyDir(path.join(appDir, '.next', 'static'), path.join(standaloneAppDir, '.next', 'static'));

console.log(`Synced standalone assets for apps/${appName}`);
