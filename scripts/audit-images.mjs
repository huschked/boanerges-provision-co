import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const roots = ['src/assets', 'public'];
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const budgetBytes = 500 * 1024;

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? collect(target) : [target];
  }));
  return nested.flat();
}

const files = (await Promise.all(roots.map(collect))).flat().filter(file => imageExtensions.has(path.extname(file).toLowerCase()));
const oversized = [];
for (const file of files) {
  const details = await stat(file);
  if (details.size > budgetBytes) oversized.push({ file, size: details.size });
}

oversized.sort((left, right) => right.size - left.size);
if (oversized.length === 0) {
  console.log(`Image audit passed: ${files.length} files are at or below 500 kB.`);
  process.exit(0);
}

console.log(`${oversized.length} of ${files.length} images exceed the 500 kB source-asset budget:`);
for (const item of oversized) console.log(`- ${(item.size / 1024).toFixed(0)} kB  ${item.file}`);
console.log('Temporary artwork may remain above budget. Optimize every final replacement before launch.');
if (process.argv.includes('--strict')) process.exitCode = 1;
