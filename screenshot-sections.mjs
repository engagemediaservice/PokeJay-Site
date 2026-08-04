import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'temporary screenshots');

const url = process.argv[2];
const runLabel = process.argv[3] || '';

if (!url) {
  console.error('Usage: node screenshot-sections.mjs <url> [run-label]');
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function nextIndex() {
  const files = fs.readdirSync(OUT_DIR).filter(f => /^screenshot-(\d+)/.test(f));
  const nums = files.map(f => parseInt(f.match(/^screenshot-(\d+)/)[1], 10));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

const [vw, vh] = (process.env.VIEWPORT || '1440x900').split('x').map(Number);

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: vw, height: vh });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

await page.evaluate(async () => {
  const step = Math.max(200, window.innerHeight * 0.8);
  let y = 0;
  const max = document.body.scrollHeight;
  while (y < max) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 100));
    y += step;
  }
  window.scrollTo(0, 0);
});
await new Promise((r) => setTimeout(r, 500));

const sections = await page.$$('body > header, body > section, body > footer');
console.log(`Found ${sections.length} top-level sections`);

for (const el of sections) {
  const slug = await page.evaluate(
    (node) => node.id || node.dataset.section || node.tagName.toLowerCase(),
    el
  );
  const n = nextIndex();
  const label = runLabel ? `${slug}-${runLabel}` : slug;
  const outPath = path.join(OUT_DIR, `screenshot-${n}-${label}.png`);
  await el.screenshot({ path: outPath });
  console.log(`Saved: ${outPath}`);
}

await browser.close();
