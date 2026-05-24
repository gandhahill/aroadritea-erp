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
  TZ: 'Asia/Jakarta',
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
  max_restarts: 50,
  restart_delay: 2000,
  min_uptime: '20s',
  time: true,
  watch: false,
};

module.exports = {
  apps: [
    {
      ...restartPolicy,
      name: 'aroadri-site',
      cwd: path.join(rootDir, 'apps', 'site', '.next', 'standalone', 'apps', 'site'),
      script: path.join(
        rootDir,
        'apps',
        'site',
        '.next',
        'standalone',
        'apps',
        'site',
        'server.js',
      ),
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=256',
      max_memory_restart: '320M',
      out_file: path.join(logDir, 'site.out.log'),
      error_file: path.join(logDir, 'site.err.log'),
      env: withSharedEnv({
        HOSTNAME: '127.0.0.1',
        PORT: '3000',
      }),
    },
    {
      ...restartPolicy,
      name: 'aroadri-web',
      cwd: path.join(rootDir, 'apps', 'web', '.next', 'standalone', 'apps', 'web'),
      script: path.join(rootDir, 'apps', 'web', '.next', 'standalone', 'apps', 'web', 'server.js'),
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=448',
      max_memory_restart: '560M',
      out_file: path.join(logDir, 'web.out.log'),
      error_file: path.join(logDir, 'web.err.log'),
      env: withSharedEnv({
        HOSTNAME: '127.0.0.1',
        PORT: '3001',
        UPLOAD_STORAGE_DIR: fileEnv.UPLOAD_STORAGE_DIR ?? path.join(rootDir, 'storage', 'uploads'),
      }),
    },
    {
      ...restartPolicy,
      name: 'aroadri-mcp',
      cwd: path.join(rootDir, 'apps', 'mcp'),
      script: path.join(rootDir, 'apps', 'mcp', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      args: 'src/server.ts',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=192',
      max_memory_restart: '260M',
      out_file: path.join(logDir, 'mcp.out.log'),
      error_file: path.join(logDir, 'mcp.err.log'),
      env: withSharedEnv({
        MCP_HTTP_HOST: fileEnv.MCP_HTTP_HOST ?? '127.0.0.1',
        MCP_HTTP_PORT: fileEnv.MCP_HTTP_PORT ?? '3002',
        MCP_ENABLE_STDIO: 'false',
      }),
    },
    {
      ...restartPolicy,
      name: 'aroadri-worker',
      cwd: path.join(rootDir, 'apps', 'worker'),
      script: path.join(rootDir, 'apps', 'worker', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      args: 'src/index.ts',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=256',
      max_memory_restart: '320M',
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
