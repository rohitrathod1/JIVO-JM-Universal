const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
(async () => {
 const root = path.resolve(__dirname, '../assets/atlas');
 const source = fs.readFileSync(path.join(root, 'atlas-ai.svg'), 'utf8');
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 const page = await browser.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 2 });
 await page.setContent('<style>body{margin:0;background:transparent}svg{display:block}</style>' + source);
 await page.evaluate(() => {
   document.querySelector('svg style').remove();
   document.querySelector('.motion').remove();
   document.querySelector('.smile-mouth').style.visibility = 'hidden';
 });
 await page.screenshot({ path: path.join(root, 'orbit-eyes.png'), omitBackground: true });
 await page.evaluate(() => {
   document.querySelectorAll('svg > g').forEach(g => g.style.visibility = 'hidden');
   document.querySelector('.smile-mouth').style.visibility = 'visible';
 });
 await page.screenshot({ path: path.join(root, 'smile.png'), omitBackground: true, clip: { x: 98, y: 136, width: 60, height: 24 } });
 await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
