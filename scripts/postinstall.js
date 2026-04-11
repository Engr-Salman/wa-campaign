const { spawnSync } = require('child_process');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const isNetlify = process.env.NETLIFY === 'true';

if (isNetlify) {
  console.log('[postinstall] Netlify detected. Installing frontend dependencies only.');
  run('npm', ['--prefix', 'frontend', 'install']);
} else {
  console.log('[postinstall] Installing backend and frontend dependencies.');
  run('npm', ['--prefix', 'backend', 'install']);
  run('npm', ['--prefix', 'frontend', 'install']);
}
