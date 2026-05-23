#!/usr/bin/env node
/**
 * Build PNG assets from the SVG sources.
 *
 * Generates a full asset bundle:
 *   images/
 *   ├── icon.png            128×128  — VS Code Marketplace extension icon
 *   ├── icon-256.png        256×256  — medium-res icon
 *   ├── icon-512.png        512×512  — social media profile pic (Twitter/LinkedIn/GitHub)
 *   ├── icon-1024.png      1024×1024 — high-res for any context
 *   ├── icon-bg-white.png   512×512  — icon on white square background
 *   ├── icon-bg-dark.png    512×512  — icon on dark square background
 *   ├── logo.png            960×wide — README banner (transparent)
 *   ├── logo-2x.png        1920×wide — high-DPI README banner
 *   └── logo-bg-white.png  1920×wide — banner on white (presentations, slides)
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

const MARK_SVG = join(ROOT, 'docs', 'assets', 'logo-mark.svg');
const LOGO_SVG = join(ROOT, 'docs', 'assets', 'logo.svg');

/**
 * Wrap an SVG inside another SVG that adds a solid background fill.
 * resvg-js doesn't support a "background-color CSS prop", so we synthesize a wrapper.
 */
function wrapWithBackground(innerSvg, bgColor) {
  // Extract viewBox from the inner SVG
  const viewBoxMatch = innerSvg.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) throw new Error('Could not find viewBox in source SVG');
  const [, viewBox] = viewBoxMatch;
  const [, , w, h] = viewBox.split(/\s+/).map(Number);
  // Strip the outer <svg ...> wrapper from inner so we can compose
  const inner = innerSvg.replace(/<\?xml[^?]*\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
    <rect width="${w}" height="${h}" fill="${bgColor}"/>
    ${inner}
  </svg>`;
}

/**
 * Pad a square icon onto a wider/taller canvas with a background fill.
 * Used to produce 1:1 social-media safe variants.
 */
function padToSquare(innerSvg, padding, bgColor) {
  const viewBoxMatch = innerSvg.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) throw new Error('Could not find viewBox');
  const [, viewBox] = viewBoxMatch;
  const [, , w, h] = viewBox.split(/\s+/).map(Number);
  const totalW = w + padding * 2;
  const totalH = h + padding * 2;
  const inner = innerSvg.replace(/<\?xml[^?]*\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}">
    <rect width="${totalW}" height="${totalH}" fill="${bgColor}"/>
    <g transform="translate(${padding}, ${padding})">${inner}</g>
  </svg>`;
}

function render(svg, width, outName) {
  const resvg = new Resvg(svg, {
    fitTo: {mode: 'width', value: width},
    background: 'rgba(0,0,0,0)',
    font: {loadSystemFonts: true},
  });
  const png = resvg.render().asPng();
  const outPath = join(OUT_DIR, outName);
  writeFileSync(outPath, png);
  const sizeKB = Math.round(png.length / 1024);
  console.log(`  ✓ ${outName} (${sizeKB} KB, ${width}px wide)`);
}

mkdirSync(OUT_DIR, {recursive: true});

const markSvg = readFileSync(MARK_SVG, 'utf-8');
const logoSvg = readFileSync(LOGO_SVG, 'utf-8');

console.log('▶ Icon (transparent, square):');
render(markSvg, 128,  'icon.png');
render(markSvg, 256,  'icon-256.png');
render(markSvg, 512,  'icon-512.png');
render(markSvg, 1024, 'icon-1024.png');

console.log('\n▶ Icon on solid background (for social media profile pics):');
render(padToSquare(markSvg, 24, '#ffffff'), 512, 'icon-bg-white.png');
render(padToSquare(markSvg, 24, '#0a0a0f'), 512, 'icon-bg-dark.png');

console.log('\n▶ Logo banner (transparent):');
render(logoSvg, 480,  'logo-128.png');   // ~128px tall (matches viewBox aspect 480:128)
render(logoSvg, 960,  'logo.png');       // ~256px tall (README banner default)
render(logoSvg, 1920, 'logo-2x.png');    // hi-DPI / hero images

console.log('\n▶ Logo banner on solid background:');
render(wrapWithBackground(logoSvg, '#ffffff'), 480,  'logo-128-bg-white.png');
render(wrapWithBackground(logoSvg, '#0a0a0f'), 480,  'logo-128-bg-dark.png');
render(wrapWithBackground(logoSvg, '#ffffff'), 1920, 'logo-bg-white.png');
render(wrapWithBackground(logoSvg, '#0a0a0f'), 1920, 'logo-bg-dark.png');

console.log('\n✓ All assets written to ' + OUT_DIR);
