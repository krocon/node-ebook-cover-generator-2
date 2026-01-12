const { path7za } = require('7zip-bin');
const { spawnSync } = require('child_process');
const fs = require('fs');

console.log('Checking 7-Zip binary...');
console.log('Path:', path7za);

if (!path7za || !fs.existsSync(path7za)) {
  console.error('7-Zip binary not found at ' + path7za);
  process.exit(1);
}

// On Unix-like systems, ensure it's executable
if (process.platform !== 'win32') {
  try {
    fs.chmodSync(path7za, 0o755);
  } catch (err) {
    console.warn('Could not chmod 7zip binary:', err.message);
  }
}

const res = spawnSync(path7za, ['-h'], { stdio: 'ignore' });

if (res.error) {
  console.error('7-Zip binary not executable:', res.error.message);
  process.exit(1);
}

console.log('7-Zip binary is working correctly.');
