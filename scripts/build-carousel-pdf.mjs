#!/usr/bin/env node
/**
 * Render docs/linkedin-carousel.html to a multi-page PDF (one slide per page).
 *
 * Approach: render each .slide element INDIVIDUALLY using Puppeteer (so
 * page-break edge cases are bypassed entirely), then merge all per-slide PDFs
 * into one with pdf-lib. Every page is guaranteed to be exactly 1080×1080
 * with full color preservation.
 *
 * Run: npm run build:carousel
 * Output: docs/linkedin-carousel.pdf
 */
import puppeteer from 'puppeteer';
import {PDFDocument} from 'pdf-lib';
import {writeFileSync} from 'fs';
import {dirname, join} from 'path';
import {fileURLToPath, pathToFileURL} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const HTML_PATH = join(ROOT, 'docs', 'linkedin-carousel.html');
const PDF_PATH = join(ROOT, 'docs', 'linkedin-carousel.pdf');

const SLIDE_PX = 1080;

console.log(`▶ Launching headless browser…`);
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({width: SLIDE_PX, height: SLIDE_PX, deviceScaleFactor: 2});

  console.log(`▶ Loading ${HTML_PATH}`);
  await page.goto(pathToFileURL(HTML_PATH).href, {waitUntil: 'networkidle0'});

  // Wait for web fonts (Inter / JetBrains Mono) to actually finish loading
  await page.evaluateHandle('document.fonts.ready');

  const slideCount = await page.$$eval('.slide', (els) => els.length);
  console.log(`▶ Found ${slideCount} slides; rendering one per page…`);

  const merged = await PDFDocument.create();

  for (let i = 0; i < slideCount; i++) {
    // Hide all slides except slide `i`. Reset body so this slide sits at (0,0).
    await page.evaluate((idx) => {
      const slides = document.querySelectorAll('.slide');
      slides.forEach((el, j) => {
        el.style.display = j === idx ? 'flex' : 'none';
        el.style.margin = '0';
      });
      const preview = document.querySelector('.preview-only');
      if (preview) preview.style.display = 'none';
      document.body.style.padding = '0';
      document.body.style.margin = '0';
      document.body.style.background = 'transparent';
    }, i);

    const slidePdfBytes = await page.pdf({
      width: `${SLIDE_PX}px`,
      height: `${SLIDE_PX}px`,
      printBackground: true,
      margin: {top: 0, right: 0, bottom: 0, left: 0},
    });

    const slideDoc = await PDFDocument.load(slidePdfBytes);
    // Take only the first page from each per-slide PDF (in case anything overflows)
    const [copiedPage] = await merged.copyPages(slideDoc, [0]);
    merged.addPage(copiedPage);
    process.stdout.write(`  ✓ slide ${i + 1}/${slideCount}\n`);
  }

  const finalBytes = await merged.save();
  writeFileSync(PDF_PATH, finalBytes);
  console.log(`✓ Wrote ${PDF_PATH} (${slideCount} pages, ${Math.round(finalBytes.length / 1024)} KB)`);
} finally {
  await browser.close();
}
