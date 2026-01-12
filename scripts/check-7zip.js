const { path7za } = require('7zip-bin');
const { spawnSync } = require('child_process');

const res = spawnSync(path7za, ['-h'], { stdio: 'ignore' });

if (res.error) {
  console.error('7-Zip binary not executable');
  process.exit(1);
}
