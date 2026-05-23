#!/usr/bin/env node
// One-shot: screenshot slide N as PNG to confirm colors render correctly.
// Usage: node scripts/preview-slide.mjs <slide-number>
import puppeteer from 'puppeteer';
import {dirname, join} from 'path';
import {fileURLToPath, pathToFileURL} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const HTML_PATH = join(ROOT, 'docs', 'linkedin-carousel.html');
const idx = parseInt(process.argv[2] ?? '0', 10);

const browser = await puppeteer.launch({args: ['--no-sandbox']});
const page = await browser.newPage();
await page.setViewport({width: 1080, height: 1080, deviceScaleFactor: 1});
await page.goto(pathToFileURL(HTML_PATH).href, {waitUntil: 'networkidle0'});
await page.evaluateHandle('document.fonts.ready');
await page.evaluate((i) => {
  document.querySelectorAll('.slide').forEach((el, j) => {
    el.style.display = j === i ? 'flex' : 'none';
    el.style.margin = '0';
  });
  const preview = document.querySelector('.preview-only');
  if (preview) preview.style.display = 'none';
  document.body.style.padding = '0';
  document.body.style.margin = '0';
}, idx);
const outPath = join(ROOT, 'docs', `slide-${idx + 1}.png`);
await page.screenshot({path: outPath, fullPage: false, clip: {x: 0, y: 0, width: 1080, height: 1080}});
await browser.close();
console.log(`✓ ${outPath}`);
