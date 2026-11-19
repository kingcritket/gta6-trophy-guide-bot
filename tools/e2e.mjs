// End-to-end checks for the Leonida Ledger app, driven over Chrome
// DevTools Protocol with Node's built-in WebSocket (no dependencies).
// Starts serve.ts on port 8091, opens the app in headless Chromium, and
// asserts: no network request leaves the local server; the checklist
// renders all 55 trophies with 13 seeded earned; grade/kind/search
// filters; spoiler mode hides unearned story trophies; export downloads
// a file and importing it (and a 3-trophy file) restores the same state;
// progress survives a reload; roadmap and missables routes render.
// Then it takes the four screenshots of shots.json as JPEGs into
// screenshots/. Usage: node tools/e2e.mjs [--shots-only]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8091;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;
const PROFILE = '/tmp/leonida-e2e-profile';
const DOWNLOADS = '/tmp/leonida-e2e-downloads';
const shotsOnly = process.argv.includes('--shots-only');

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`PASS ${name}`); }
  else { failed += 1; console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  mkdirSync(DOWNLOADS, { recursive: true });
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: 'pipe' });
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=9223`, `--user-data-dir=${PROFILE}`,
    '--window-size=1280,800', 'about:blank',
  ], { stdio: 'pipe' });
  const cleanup = () => { try { chrome.kill('SIGKILL'); } catch {} try { server.kill('SIGKILL'); } catch {} };
  process.on('exit', cleanup);

  try {
    // Wait for the debug endpoint.
    let targets = null;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9223/json/list');
        targets = await res.json();
        break;
      } catch { await sleep(250); }
    }
    if (!targets) throw new Error('Chrome DevTools endpoint never came up');
    const page = targets.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let nextId = 1;
    const pending = new Map();
    const requests = [];
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
      if (msg.method === 'Network.requestWillBeSent') requests.push(msg.params.request.url);
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evalJs = async (expression) => {
      const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (res.exceptionDetails) throw new Error(res.exceptionDetails.text + ' ' + (res.exceptionDetails.exception?.description || ''));
      return res.result.value;
    };
    const waitFor = async (expression, label, timeoutMs = 8000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try { if (await evalJs(expression)) return true; } catch {}
        await sleep(200);
      }
      throw new Error(`timeout waiting for: ${label}`);
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    // Pin the viewport to 1280x800: --window-size alone leaves headless
    // Chrome at 800x600 height for captures.
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    try { await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS }); } catch {}
    try { await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS }); } catch {}

    const goto = async (url) => {
      await send('Page.navigate', { url });
      await waitFor(`document.getElementById('view') && document.getElementById('view').children.length > 0`, `render of ${url}`);
      await sleep(300);
    };

    if (!shotsOnly) {
      // Phase A — seeded checklist.
      await goto(`${BASE}/?seed=13`);
      check('checklist renders 55 rows', (await evalJs(`document.querySelectorAll('#rows .trophy').length`)) === 55);
      check('seeded progress is 13 of 55', (await evalJs(`document.getElementById('earnedCount').textContent`)) === '13');
      check('grade stats show Gold 0/2', (await evalJs(`document.getElementById('gradeStats').textContent`)).includes('Gold 0/2'));

      // Phase B — filters (each snippet uses fresh variable names: a
      // top-level const/let persists across Runtime.evaluate calls, so
      // redeclaring one throws a SyntaxError and the snippet never runs).
      await evalJs(`const g1=document.getElementById('gradeFilter'); g1.value='silver'; g1.dispatchEvent(new Event('change'))`);
      check('grade filter silver shows 6', (await evalJs(`document.querySelectorAll('#rows .trophy').length`)) === 6);
      await evalJs(`const g2=document.getElementById('gradeFilter'); g2.value='all'; g2.dispatchEvent(new Event('change')); const k2=document.getElementById('kindFilter'); k2.value='collectibles'; k2.dispatchEvent(new Event('change'))`);
      check('kind filter collectibles shows 5', (await evalJs(`document.querySelectorAll('#rows .trophy').length`)) === 5);
      await evalJs(`const k3=document.getElementById('kindFilter'); k3.value='all'; k3.dispatchEvent(new Event('change')); const q3=document.getElementById('search'); q3.value='meditat'; q3.dispatchEvent(new Event('input'))`);
      // 'meditat' matches 2: Positive Mental Attitude itself, and Paradise
      // Lost, whose guide cross-references the Chapter 1 meditation warning.
      check('search "meditat" shows 2', (await evalJs(`document.querySelectorAll('#rows .trophy').length`)) === 2);
      await evalJs(`const q4=document.getElementById('search'); q4.value=''; q4.dispatchEvent(new Event('input'))`);

      // Phase C — spoiler mode hides unearned story trophies.
      await evalJs(`document.getElementById('spoilerToggle').click()`);
      check('spoiler on: 5 story trophies hidden', (await evalJs(`document.querySelectorAll('#rows .spoiler-hidden').length`)) === 5);
      check('spoiler on: DWNFALL name hidden', !(await evalJs(`document.body.textContent`)).includes('DWNFALL'));
      check('spoiler on: earned story trophy still shown', (await evalJs(`document.body.textContent`)).includes('Paradise Lost'));
      await evalJs(`location.hash = '#/trophy/11'`);
      await sleep(400);
      check('spoiler on: detail page hides unearned story trophy', (await evalJs(`document.body.textContent`)).includes('Hidden trophy') && !(await evalJs(`document.body.textContent`)).includes('DWNFALL'));
      await evalJs(`location.hash = '#/missables'`);
      await sleep(400);
      check('spoiler on: missables list masks story names', !(await evalJs(`document.body.textContent`)).includes('DWNFALL') && (await evalJs(`document.body.textContent`)).includes('Positive Mental Attitude'));
      await evalJs(`location.hash = '#/'`);
      await sleep(400);
      await evalJs(`document.getElementById('spoilerToggle').click()`);
      check('spoiler off: DWNFALL visible again', (await evalJs(`document.body.textContent`)).includes('DWNFALL'));

      // Phase D — export downloads a file; import restores state.
      await evalJs(`document.getElementById('exportBtn').click()`);
      let exported = null;
      for (let i = 0; i < 20; i++) {
        await sleep(250);
        const file = join(DOWNLOADS, 'leonida-ledger-progress.json');
        if (existsSync(file)) { exported = readFileSync(file, 'utf8'); break; }
      }
      check('export downloads a progress file', exported !== null);
      let exportedNames = [];
      if (exported) {
        const parsed = JSON.parse(exported);
        exportedNames = parsed.earned;
        check('exported file holds 13 earned', parsed.earned.length === 13);
        check('exported file names Vice City, Baby!', parsed.earned.includes('Vice City, Baby!'));
      }
      const three = { app: 'leonida-ledger', version: 1, spoiler: false, earned: ['Just Like Paradise', 'Paradise Lost', 'Vice Got a Price!'] };
      writeFileSync('/tmp/leonida-e2e-import.json', JSON.stringify(three));
      const doc = await send('DOM.getDocument', { depth: -1 });
      const { nodeId: inputId } = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#importFile' });
      await send('DOM.setFileInputFiles', { nodeId: inputId, files: ['/tmp/leonida-e2e-import.json'] });
      await waitFor(`document.getElementById('earnedCount').textContent === '3'`, 'import of 3-trophy file');
      check('import of 3-trophy file sets progress to 3', true);
      const restored = await evalJs(`window.__trophyGuide.importData(${JSON.stringify(exported)})`);
      check('import of exported file restores 13', restored === 13);
      await send('Page.navigate', { url: `${BASE}/` });
      await waitFor(`document.getElementById('earnedCount').textContent === '13'`, 'progress after reload');
      check('progress survives reload (localStorage)', true);

      // Phase E — routes.
      await goto(`${BASE}/#/roadmap`);
      check('roadmap renders with 200 hours', (await evalJs(`document.body.textContent`)).includes('200 hours'));
      await goto(`${BASE}/#/missables`);
      check('missables page flags Positive Mental Attitude', (await evalJs(`document.body.textContent`)).includes('Positive Mental Attitude'));

      // Network: nothing leaves the local server.
      const outside = requests.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:'));
      check('no network request outside the local server', outside.length === 0, outside.join(', '));
      console.log(`network requests seen: ${requests.length}`);
    }

    // Phase F — screenshots from shots.json.
    const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
    await evalJs(`localStorage.clear()`);
    for (const shot of shots) {
      const url = `${BASE}${shot.path}`;
      await send('Page.navigate', { url });
      await waitFor(`document.getElementById('view') && document.getElementById('view').children.length > 0`, `render of ${shot.path}`);
      await sleep(400);
      const { data: b64 } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
      const out = join(here, 'screenshots', shot.file);
      writeFileSync(out, Buffer.from(b64, 'base64'));
      console.log(`shot ${shot.file} written`);
    }
    ws.close();
  } finally {
    cleanup();
  }
  console.log(`\nE2E: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => { console.error('E2E ERROR', error); process.exit(2); });
