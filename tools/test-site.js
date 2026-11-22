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
  await page.keyboard.down('ArrowLeft');
  await wait(700);
  await page.keyboard.up('ArrowLeft');
  await wait(900);
  check('holding an arrow drives the truck', await page.evaluate(() => __dump.dx) < start - 10);

  // Out on the road: no billboard media is fetched until a board comes near.
  const road = await page.evaluate(() => __dump.road());
  const fetched = () => page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.includes('/boards/')).map(r => r.name.split('/').pop()));
  check('billboard media loads only as boards come near', (await fetched()).length <= 2, (await fetched()).join(', '));
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(d => -__dump.camX >= d, { timeout: 60000, polling: 50 }, road.boards[1].D);
  await page.keyboard.up('ArrowLeft');
  await wait(1500);
  const far = await page.evaluate(() => ({ dx: __dump.dx, cam: __dump.camX }));
  check('the road carries on past the screen edge, camera following', far.dx < -300 && Math.abs(far.cam - far.dx) < 5,
    `truck ${Math.round(far.dx)}, camera ${Math.round(far.cam)}`);
  const board = (await page.evaluate(() => __dump.boards())).find(b => b.id === 'traffic-vision');
  const boardAt = await page.evaluate((x, y) => __dump.toScreen(x, y), board.x + board.w / 2, board.y + board.h * .3);
  await page.mouse.click(boardAt.x, boardAt.y);
  await wait(350);
  check('clicking a billboard opens its record',
    await page.$eval('#tag', e => e.open) && await page.$eval('#tag-name', e => e.textContent) === 'TrafficVision');
  check('its record lists the team', await page.$eval('#tag-fields', e => e.textContent.includes('Deep Das')));
  await page.keyboard.press('Escape');
  await wait(150);

  // On to the end of the road.
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => __dump.dx <= __dump.limits().min + 1, { timeout: 90000, polling: 100 });
  await wait(600);
  await page.keyboard.up('ArrowLeft');
  const end = await page.evaluate(() => ({ dx: __dump.dx, min: __dump.limits().min, boards: __dump.boards() }));
  check('the truck stops at the road block', Math.abs(end.dx - end.min) < 1 && end.min === -road.end);
  check('the contact board is in view at the end', end.boards.find(b => b.id === 'contact')?.onScreen);
  const played = await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.endsWith('.mp4')));
  check('billboard videos load on the way', played);

  // Billboards stand still on the ground and never overlap.
  const before = await page.evaluate(() => __dump.boards().map(b => ({ id: b.id, x: b.x, w: b.w })));
  await page.keyboard.down('ArrowRight');
  await wait(800);
  await page.keyboard.up('ArrowRight');
  await wait(800);
  const after = await page.evaluate(() => __dump.boards().map(b => ({ id: b.id, x: b.x })));
  check('billboards stay put as the truck drives', before.every((b, i) => Math.abs(b.x - after[i].x) < .01));
  const spans = before.map(b => [b.x, b.x + b.w]).sort((a, b) => a[0] - b[0]);
  check('no billboards overlap', spans.every((s, i) => i === 0 || s[0] > spans[i - 1][1]));

  // The text version and structured data, for screen readers and search engines.
  const text = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent,
    sections: document.querySelectorAll('#text-entries section').length,
    ld: (() => { try { return JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'][0].name; } catch { return null; } })(),
  }));
  check('the text version lists every entry under one heading', text.h1 === 'Sangamlung Gangmei' && text.sections === end.boards.length, `${text.sections} sections`);
  check('structured data names the person', text.ld === 'Sangamlung Gangmei');
  await page.evaluate(() => [...document.querySelectorAll('#text button')].find(b => b.closest('section').querySelector('h2').textContent === 'This space is available').click());
  await wait(300);
  check('the contact record has a copy-email button', await page.$$eval('#tag-links button', bs => bs.some(b => b.textContent === 'Copy email')));
  await page.keyboard.press('Escape');
  await wait(150);

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
  const box = id => page.$eval(id, e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const [left, right, unloadBox] = [await box('#go-forward'), await box('#go-backward'), await box('#unload')];
  check('phone: arrows sit under each thumb with Unload between',
    left.x < 60 && right.x + right.w > 330 && unloadBox.x > left.x + left.w && unloadBox.x + unloadBox.w < right.x);

  const start = await page.evaluate(() => __dump.dx);
  await page.touchscreen.touchStart(left.x + left.w / 2, left.y + left.h / 2);
  await wait(700);
  await page.touchscreen.touchEnd();
  await wait(900);
  check('phone: holding an arrow drives the truck', await page.evaluate(() => __dump.dx) < start - 10);

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
