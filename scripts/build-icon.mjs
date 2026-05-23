#!/usr/bin/env node
/**
 * Build PNG assets from the SVG sources.
 *
 *  - images/icon.png  (128×128)  — from logo-mark.svg → Marketplace extension icon
 *  - images/logo.png  (960px wide) — from logo.svg → README banner (Marketplace doesn't accept SVG in README)
 *
 * Run: npm run build:icon
 */
import {Resvg} from '@resvg/resvg-js';
import {readFileSync, writeFileSync, mkdirSync} from 'fs';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'images');

const TARGETS = [
  {svg: join(ROOT, 'docs', 'assets', 'logo-mark.svg'), out: 'icon.png', width: 128},
  {svg: join(ROOT, 'docs', 'assets', 'logo.svg'),      out: 'logo.png', width: 960},
];

function build({svg: svgPath, out, width}) {
  const svg = readFileSync(svgPath);
  const resvg = new Resvg(svg, {
    fitTo: {mode: 'width', value: width},
    background: 'rgba(0,0,0,0)',
    font: {loadSystemFonts: true},
  });
  const png = resvg.render().asPng();
  const outPath = join(OUT_DIR, out);
  writeFileSync(outPath, png);
  console.log(`✓ Wrote ${outPath} (${png.length} bytes, width=${width}px)`);
}

try {
  mkdirSync(OUT_DIR, {recursive: true});
  for (const t of TARGETS) build(t);
} catch (e) {
  console.error('build-icon failed:', e);
  process.exit(1);
}
