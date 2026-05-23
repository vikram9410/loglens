#!/usr/bin/env node
/**
 * Build the 128×128 PNG extension icon from docs/assets/logo-mark.svg.
 *
 * The Marketplace requires a PNG, not SVG. This script keeps the SVG as the
 * source of truth and generates the PNG at build time so they never drift.
 *
 * Run: npm run build:icon
 */
import {Resvg} from '@resvg/resvg-js';
import {readFileSync, writeFileSync, mkdirSync} from 'fs';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SVG_PATH = join(ROOT, 'docs', 'assets', 'logo-mark.svg');
const OUT_DIR = join(ROOT, 'images');
const OUT_PATH = join(OUT_DIR, 'icon.png');

const ICON_SIZE = 128;

function build() {
  const svg = readFileSync(SVG_PATH);
  const resvg = new Resvg(svg, {
    fitTo: {mode: 'width', value: ICON_SIZE},
    background: 'rgba(0,0,0,0)',
    font: {loadSystemFonts: false},
  });
  const png = resvg.render().asPng();
  mkdirSync(OUT_DIR, {recursive: true});
  writeFileSync(OUT_PATH, png);
  console.log(`✓ Wrote ${OUT_PATH} (${png.length} bytes, ${ICON_SIZE}×${ICON_SIZE})`);
}

try {
  build();
} catch (e) {
  console.error('build-icon failed:', e);
  process.exit(1);
}
