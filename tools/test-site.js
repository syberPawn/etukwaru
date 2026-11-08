// Runs the real page in Chrome with the production headers from public/_headers.
//   npm test
// Set CHROME_PATH if Chrome isn't in the default Windows location.
const puppeteer = require('puppeteer-core');
const { startServer } = require('./dev-server');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

async function openPage(browser, port, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const problems = [];
  page.on('console', m => { if (['error', 'warn'].includes(m.type())) problems.push(m.text()); });
  page.on('pageerror', e => problems.push(e.message));
  await page.goto(`http://localhost:${port}/?debug`);
  await page.waitForFunction('window.__dump', { timeout: 30000 });
  await wait(500);
  return { page, problems };
}

/** Plays one unload, watching every item for teleport-like jumps. */
async function unload(page) {
  await page.click('#unload');
  let prev = await page.evaluate(() => __dump.items());
  let jumps = 0, phase;
  do {
    await wait(50);
    const now = await page.evaluate(() => ({ phase: __dump.phase, items: __dump.items() }));
    phase = now.phase;
    now.items.forEach((it, i) => { if (prev[i].y - it.y > 140 || Math.abs(prev[i].x - it.x) > 220) jumps++; });
    prev = now.items;
  } while (phase !== 'idle');
  return { jumps, items: prev };
}

async function desktop(browser, port) {
  const { page, problems } = await openPage(browser, port, { width: 1600, height: 900 });
  const { jumps, items } = await unload(page);
  await wait(1200);
  const final = await page.evaluate(() => __dump.items());
  check('unload runs with no teleporting', jumps === 0, `${jumps} jumps`);
  check('every item stays on screen', final.every(i => i.x >= 0 && i.x <= 1800 && i.y <= 812));
  check('truck ends where it started', Math.abs(await page.evaluate(() => __dump.dx)) < 1);
  check('projects leave the carrier', items.filter(i => i.project && !i.inBed).length > 0);

  const target = final.find(i => i.project && !i.inBed);
  const at = await page.evaluate((x, y) => __dump.toScreen(x, y), target.x, target.y);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.up();
  await wait(350);
  check('clicking a project opens its tag', await page.$eval('#tag', e => e.open));
  await page.keyboard.press('Escape');
  await wait(150);

  const start = await page.evaluate(() => __dump.dx);
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowLeft');
  await wait(700);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('ArrowUp');
  await wait(900);
  check('gas plus arrow drives the truck', await page.evaluate(() => __dump.dx) < start - 10);

  // A hidden tab has to go quiet, and come back when it's visible again.
  const setHidden = value => page.evaluate(v => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => v });
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
  await setHidden(true);
  await wait(200);
  check('sound suspends in a hidden tab', await page.evaluate(() => __dump.audio) === 'suspended');
  await setHidden(false);
  await wait(200);
  check('sound resumes when visible', await page.evaluate(() => __dump.audio) === 'running');

  check('no console errors or policy violations', problems.length === 0, problems.join(' | ').slice(0, 300));
  await page.close();
}

async function phoneRotation(browser, port) {
  const { page, problems } = await openPage(browser, port, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.tap('#unload');
  await page.waitForFunction('__dump.phase==="raise"', { timeout: 30000 });
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await wait(1200);
  check('rotating mid-unload resets cleanly', await page.evaluate(() => __dump.phase) === 'idle');
  check('no errors after rotating', problems.length === 0, problems.join(' | ').slice(0, 300));
  await page.close();
}

(async () => {
  const server = await startServer();
  const { port } = server.address();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    await desktop(browser, port);
    await phoneRotation(browser, port);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
