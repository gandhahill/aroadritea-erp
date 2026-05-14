import { spawnSync } from 'node:child_process';

if (process.env.NODE_ENV === 'production') {
  throw new Error('reset-dev-db must not run with NODE_ENV=production.');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required before refreshing the development database.');
}

run('pnpm', ['--filter', '@erp/db', 'migrate']);
run('pnpm', ['--filter', '@erp/db', 'seed']);

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status ?? 'null'}`,
    );
  }
}
