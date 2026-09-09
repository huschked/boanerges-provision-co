import { build } from 'vite';
import { copyFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';

await build();

const projectRoot = process.cwd();
const generatedIndex = path.join(projectRoot, 'dist', 'index.html');
const templateDirectory = path.join(projectRoot, '.seo-build');
const serverTemplate = path.join(templateDirectory, 'storefront-shell.html');

await mkdir(templateDirectory, { recursive: true });
await copyFile(generatedIndex, serverTemplate);
await unlink(generatedIndex);

console.log('Prepared the private storefront HTML template for server-rendered routes.');
