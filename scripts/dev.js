/**
 * Runs the Express API (backend) and the Vite dev server (frontend) together
 * with one command:  npm run dev
 * Output of both processes is prefixed and streamed to this terminal.
 */
const { spawn } = require('node:child_process');

const targets = [
  { name: 'api', dir: 'backend', color: '\x1b[36m' },
  { name: 'web', dir: 'frontend', color: '\x1b[35m' },
];
const reset = '\x1b[0m';

const children = [];

targets.forEach(({ name, dir, color }) => {
  const child = spawn('npm', ['run', 'dev'], { cwd: dir, shell: process.platform === 'win32' });
  children.push(child);

  const prefix = (line) => `${color}[${name}]${reset} ${line}`;
  const pipe = (stream, out) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach((l) => out.write(`${prefix(l)}\n`));
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code) => {
    console.log(prefix(`exited with code ${code}`));
    shutdown(code ?? 0);
  });
});

function shutdown(code = 0) {
  children.forEach((c) => {
    if (!c.killed) c.kill('SIGTERM');
  });
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
