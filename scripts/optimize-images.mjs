import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const supportedExtensions = new Set(['.avif', '.jpeg', '.jpg', '.png', '.tif', '.tiff', '.webp']);
const argumentsList = process.argv.slice(2);

if (argumentsList.length === 0 || argumentsList.includes('--help')) {
  console.log('Usage: npm run images:optimize -- <file-or-directory> [more paths] [--widths=480,768,1200,1600] [--out-dir=path]');
  process.exit(argumentsList.length === 0 ? 1 : 0);
}

const widthsArgument = argumentsList.find(argument => argument.startsWith('--widths='));
const outputArgument = argumentsList.find(argument => argument.startsWith('--out-dir='));
const requestedWidths = (widthsArgument?.split('=')[1] || '480,768,1200,1600')
  .split(',')
  .map(value => Number.parseInt(value, 10))
  .filter(value => Number.isFinite(value) && value > 0)
  .sort((left, right) => left - right);
const outputDirectory = outputArgument ? path.resolve(outputArgument.split('=').slice(1).join('=')) : null;
const inputs = argumentsList.filter(argument => !argument.startsWith('--'));

async function collectImages(input) {
  const resolved = path.resolve(input);
  const entries = await readdir(resolved, { withFileTypes: true }).catch(() => null);
  if (!entries) return supportedExtensions.has(path.extname(resolved).toLowerCase()) ? [resolved] : [];

  const nested = await Promise.all(entries.map(entry => collectImages(path.join(resolved, entry.name))));
  return nested.flat();
}

const files = [...new Set((await Promise.all(inputs.map(collectImages))).flat())];
if (files.length === 0) throw new Error('No supported source images were found.');

for (const file of files) {
  const metadata = await sharp(file).metadata();
  if (!metadata.width) continue;

  const widths = [...new Set([...requestedWidths.filter(width => width < metadata.width), metadata.width])];
  const destination = outputDirectory || path.dirname(file);
  const extension = path.extname(file);
  const basename = path.basename(file, extension);
  await mkdir(destination, { recursive: true });

  for (const width of widths) {
    const pipeline = sharp(file).rotate().resize({ width, withoutEnlargement: true });
    const webpPath = path.join(destination, `${basename}-${width}.webp`);
    const avifPath = path.join(destination, `${basename}-${width}.avif`);
    await pipeline.clone().webp({ quality: 78, effort: 5 }).toFile(webpPath);
    await pipeline.clone().avif({ quality: 50, effort: 5 }).toFile(avifPath);
    console.log(`${path.relative(process.cwd(), file)} -> ${path.relative(process.cwd(), webpPath)}, ${path.relative(process.cwd(), avifPath)}`);
  }
}
