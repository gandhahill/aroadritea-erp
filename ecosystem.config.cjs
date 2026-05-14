const fs = require('node:fs');
const path = require('node:path');

const rootDir = __dirname;
const logDir = path.join(rootDir, 'logs', 'pm2');

fs.mkdirSync(logDir, { recursive: true });

function parseEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const env = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) continue;

    env[match[1]] = parseEnvValue(match[2]);
  }
  return env;
}

const fileEnv = loadDotEnv(path.join(rootDir, '.env'));
const sharedEnv = {
  ...fileEnv,
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
};

function withSharedEnv(extra = {}) {
  return {
    ...sharedEnv,
    ...extra,
  };
}

const restartPolicy = {
  autorestart: true,
  exp_backoff_restart_delay: 5000,
  kill_timeout: 10000,
  max_restarts: 10,
  min_uptime: '20s',
  time: true,
  watch: false,
};

module.exports = {
  apps: [
    {
      ...restartPolicy,
      name: 'aroadri-site',
      cwd: path.join(rootDir, 'apps', 'site'),
      script: path.join(rootDir, 'apps', 'site', 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: 'start -p 3000',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=384',
      max_memory_restart: '450M',
      out_file: path.join(logDir, 'site.out.log'),
      error_file: path.join(logDir, 'site.err.log'),
      env: withSharedEnv({
        PORT: '3000',
      }),
    },
    {
      ...restartPolicy,
      name: 'aroadri-web',
      cwd: path.join(rootDir, 'apps', 'web'),
      script: path.join(rootDir, 'apps', 'web', 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: 'start -p 3001',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=512',
      max_memory_restart: '650M',
      out_file: path.join(logDir, 'web.out.log'),
      error_file: path.join(logDir, 'web.err.log'),
      env: withSharedEnv({
        PORT: '3001',
      }),
    },
    {
      ...restartPolicy,
      name: 'aroadri-mcp',
      cwd: path.join(rootDir, 'apps', 'mcp'),
      script: path.join(rootDir, 'apps', 'mcp', 'dist', 'server.js'),
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=256',
      max_memory_restart: '320M',
      out_file: path.join(logDir, 'mcp.out.log'),
      error_file: path.join(logDir, 'mcp.err.log'),
      env: withSharedEnv({
        MCP_HTTP_PORT: fileEnv.MCP_HTTP_PORT ?? '3002',
      }),
    },
    {
      ...restartPolicy,
      name: 'aroadri-worker',
      cwd: path.join(rootDir, 'apps', 'worker'),
      script: path.join(rootDir, 'apps', 'worker', 'dist', 'index.js'),
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=384',
      max_memory_restart: '450M',
      out_file: path.join(logDir, 'worker.out.log'),
      error_file: path.join(logDir, 'worker.err.log'),
      env: withSharedEnv({
        SITE_HEALTH_URL: fileEnv.SITE_HEALTH_URL ?? 'http://127.0.0.1:3000/api/healthz',
        WEB_HEALTH_URL: fileEnv.WEB_HEALTH_URL ?? 'http://127.0.0.1:3001/api/healthz',
        MCP_HEALTH_URL: fileEnv.MCP_HEALTH_URL ?? 'http://127.0.0.1:3002/healthz',
      }),
    },
  ],
};
