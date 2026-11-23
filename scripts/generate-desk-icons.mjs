// Run with Node and librsvg's rsvg-convert on PATH.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const assets = new URL('../public/icons/', import.meta.url);
const source = readFileSync(new URL('desk-icon.svg', assets), 'utf8');
const defaultVariant = 'data-variant="app"';
const svgRoot = source.slice(0, source.indexOf('>') + 1);
if (!svgRoot.includes(defaultVariant)) {
  throw new Error('Set data-variant="app" on the root of desk-icon.svg.');
}

const variant = (name) =>
  source.replace(defaultVariant, `data-variant="${name}"`);

const pngs = [
  ['desk-180.png', 180, 'touch'],
  ['desk-192.png', 192, 'app'],
  ['desk-512.png', 512, 'app'],
  ['desk-maskable-512.png', 512, 'maskable'],
  ['desk-maskable-1024.png', 1024, 'maskable'],
];

const files = pngs.map(([file, width, name]) => [
  file,
  execFileSync('rsvg-convert', ['--width', String(width)], {
    input: variant(name),
  }),
]);
for (const [file, contents] of files) {
  writeFileSync(new URL(file, assets), contents);
}
writeFileSync(new URL('../favicon.svg', assets), variant('favicon'));
