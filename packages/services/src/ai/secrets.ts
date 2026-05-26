import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function cleanSecret(value: string | undefined): string {
  return (value ?? '').trim().replace(/^["']|["']$/g, '');
}

function envFileCandidates(): string[] {
  if (process.env.AROADRI_ENV_FILE) {
    return [path.resolve(process.env.AROADRI_ENV_FILE)];
  }
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), '..', '..', '.env'),
  ];
  return Array.from(new Set(candidates.map((candidate) => path.resolve(candidate))));
}

export function readSecret(names: string[]): string {
  for (const name of names) {
    const direct = cleanSecret(process.env[name]);
    if (direct) return direct;
  }

  for (const envPath of envFileCandidates()) {
    if (!existsSync(envPath)) continue;
    let content = '';
    try {
      content = readFileSync(envPath, 'utf8');
    } catch {
      continue;
    }
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = content.match(new RegExp(`^${escaped}\\s*=\\s*(.*)$`, 'm'));
      const fromFile = cleanSecret(match?.[1]);
      if (fromFile) return fromFile;
    }
  }

  return '';
}
