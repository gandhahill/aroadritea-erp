import { spawn } from 'child_process';

const child = spawn('npx', ['drizzle-kit', 'generate'], {
  cwd: 'd:\\KERJA\\Aroadri Tea\\ERP\\packages\\db',
  shell: true,
});

child.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  if (output.includes('Is sequences table created or renamed')) {
    child.stdin.write('\n');
  }
  if (output.includes('Is absence_dispensations table created or renamed')) {
    child.stdin.write('\n');
  }
  if (output.includes('created or renamed from another table?')) {
    child.stdin.write('\n');
  }
});

child.stderr.on('data', (data) => {
  console.error(data.toString());
});

child.on('exit', (code) => {
  console.log('Exited with code', code);
  process.exit(code);
});
