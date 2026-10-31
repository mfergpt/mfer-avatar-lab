import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname } from 'node:path';

const localPath = /(?:\/Users\/|\/home\/(?!web_user)|[A-Za-z]:\\Users\\)/;
const findings = [];
async function check(path) {
  if (path.includes('/vendor/')) return; // Preserve upstream notices and runtime files.
  const data = await readFile(path);
  let text;
  if (extname(path) === '.glb') {
    const size = data.readUInt32LE(12);
    if (data.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`Invalid GLB JSON chunk: ${path}`);
    text = data.subarray(20, 20 + size).toString('utf8');
  } else if (/\.(?:js|mjs|ts|json|html|md|yml|css)$/.test(path)) text = data.toString('utf8');
  if (text && localPath.test(text)) findings.push(path);
}
async function walk(directory) {
  for (const name of await readdir(directory)) {
    const path = `${directory}/${name}`;
    if (path.includes('/vendor/')) continue;
    if ((await stat(path)).isDirectory()) await walk(path); else await check(path);
  }
}
if (process.argv.includes('--dist')) await walk('dist');
else {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const path of files) await check(path);
}
if (findings.length) {
  console.error(`Local filesystem paths found in: ${findings.join(', ')}`);
  process.exitCode = 1;
} else console.log('Privacy check passed: no local filesystem paths in first-party text or GLB metadata.');
