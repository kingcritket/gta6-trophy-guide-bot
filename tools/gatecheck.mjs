// Local gate check: the six gate rows the sealed scorer checks, run
// against the output of `MAKEFUN_OUTPUT_DIR=out node main.ts`.
// Usage: node tools/gatecheck.mjs [out-dir]
import { execSync, spawnSync } from 'node:child_process';
import { lstatSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url));
const out = process.argv[2] || join(here, 'out');
let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`PASS ${name}`); }
  else { failed += 1; console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = lstatSync(p);
    out.push({ path: p, rel: relative(base, p), stat: st });
    if (st.isDirectory()) out.push(...walk(p, base));
  }
  return out;
}

// 1. app_files
const appDir = join(out, 'app');
const appEntries = walk(appDir);
const appFiles = appEntries.filter((e) => e.stat.isFile());
const appBytes = appFiles.reduce((n, e) => n + e.stat.size, 0);
const symlinks = appEntries.filter((e) => e.stat.isSymbolicLink());
check('app_files: <=993 files+dirs', appEntries.length <= 993, `${appEntries.length}`);
check('app_files: <=48 MiB total', appBytes <= 48 * 1024 * 1024, `${appBytes} bytes`);
check('app_files: no symlinks', symlinks.length === 0);
check('app_files: index.html <=1 MiB', statSync(join(appDir, 'index.html')).size <= 1024 * 1024);
console.log(`  app: ${appFiles.length} files, ${appBytes} bytes`);

// Load-position references, resolved relative to the file that holds them
// (an import in app/js/main.js resolves against app/js/, as the gate does).
import { dirname } from 'node:path';
const html = readFileSync(join(appDir, 'index.html'), 'utf8');
const css = readFileSync(join(appDir, 'style.css'), 'utf8');
const loadRefs = [];
const pushRefs = (baseDir, refs) => { for (const r of refs) loadRefs.push({ ref: r, base: baseDir }); };
pushRefs(appDir, [...html.matchAll(/<(?:script|link|img|iframe|source|video|audio|track|embed|object)[^>]*?(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]));
pushRefs(appDir, [...css.matchAll(/@import[^;]*?url\(\s*["']?([^"')]+)["']?\)/gi)].map((m) => m[1]));
pushRefs(appDir, [...css.matchAll(/url\(\s*["']?(?!#)([^"')]+)["']?\)/gi)].map((m) => m[1]));
for (const f of appFiles.filter((x) => x.path.endsWith('.js'))) {
  const src = readFileSync(f.path, 'utf8');
  const base = dirname(f.path);
  pushRefs(base, [...src.matchAll(/(?:^|[^\w$])(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
  pushRefs(base, [...src.matchAll(/import\(\s*['"]([^'"]+)['"]\)/g)].map((m) => m[1]));
}
const badRefs = loadRefs.filter(({ ref: r }) => /^(https?:)?\/\//i.test(r) || /^[a-z][a-z0-9+.-]*:/i.test(r));
check('references: no absolute/network load reference', badRefs.length === 0, badRefs.map((x) => x.ref).join(', '));
function existsSync(p) { try { return statSync(p).isFile(); } catch { return false; } }
const missingRefs = loadRefs.filter(({ ref: r, base }) => !r.startsWith('data:') && !existsSync(join(base, r)));
check('references: every load reference names an app file', missingRefs.length === 0, missingRefs.map((x) => x.ref).join(', '));

// 3. screenshots
const shotsDir = join(out, 'screenshots');
const shots = readdirSync(shotsDir).filter((n) => !n.startsWith('.'));
check('screenshots: 3-4 images', shots.length >= 3 && shots.length <= 4, `${shots.length}`);
for (const shot of shots) {
  const size = statSync(join(shotsDir, shot)).size;
  check(`screenshots: ${shot} <=256 KiB`, size <= 256 * 1024, `${size} bytes`);
}
const dims = spawnSync('python3', ['-c',
  `import json,sys; from PIL import Image
import os
print(json.dumps({f: list(Image.open(os.path.join(sys.argv[1], f)).size) for f in sorted(os.listdir(sys.argv[1])) if not f.startswith('.')}))`,
  shotsDir], { encoding: 'utf8' });
if (dims.status === 0) {
  const sizes = JSON.parse(dims.stdout);
  for (const [name, [w, h]] of Object.entries(sizes)) {
    check(`screenshots: ${name} is 1280x800`, w === 1280 && h === 800, `${w}x${h}`);
    check(`screenshots: ${name} long side <=1280, short side >=480`, Math.max(w, h) <= 1280 && Math.min(w, h) >= 480);
  }
} else {
  console.log('WARN could not read screenshot dimensions (PIL)');
}

// 4. dossier_matches — rebuild and compare bytes
const dossierA = readFileSync(join(out, 'dossier.json'));
const dossierOut = join(here, 'out-rebuild');
spawnSync('node', ['main.ts'], { cwd: here, env: { ...process.env, MAKEFUN_OUTPUT_DIR: dossierOut }, stdio: 'pipe' });
const dossierB = readFileSync(join(dossierOut, 'dossier.json'));
check('dossier_matches: rebuild is byte-identical', dossierA.equals(dossierB), `${dossierA.length} vs ${dossierB.length} bytes`);
check('dossier_matches: dossier <=1.5 MiB', dossierA.length <= 1572864, `${dossierA.length} bytes`);

// 5. trophies — names against the kit starter's official list
const trophies = JSON.parse(readFileSync(join(appDir, 'data', 'trophies.json'), 'utf8'));
const kit = JSON.parse(readFileSync(join(here, '..', 'gta6-trophy-guide-01-kit', 'gta6-trophy-guide-01-kit', 'starter', 'app', 'data', 'trophies.json'), 'utf8'));
const norm = (s) => s.normalize('NFKC').replace(/[‘’]/g, "'").replace(/[–—−]/g, '-').replace(/…/g, '...').replace(/\s+/g, ' ').toLowerCase();
const kitNames = new Set(kit.trophies.map((t) => norm(t.name)));
const mineNames = trophies.trophies.map((t) => norm(t.name));
const missingT = [...kitNames].filter((n) => !mineNames.includes(n));
const noGuide = trophies.trophies.filter((t) => !t.guide || !t.guide.trim()).map((t) => t.name);
check('trophies: all 55 official names present', trophies.trophies.length === 55 && missingT.length === 0, missingT.join(', '));
check('trophies: every trophy has a non-blank guide', noGuide.length === 0, noGuide.join(', '));

// 6. js_parses — node --check on .mjs copies (parse only, never execute)
for (const f of appFiles.filter((x) => x.path.endsWith('.js'))) {
  const tmp = `/tmp/gatecheck-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`;
  writeFileSync(tmp, readFileSync(f.path, 'utf8'));
  const r = spawnSync('node', ['--check', tmp], { encoding: 'utf8' });
  check(`js_parses: ${f.rel} parses`, r.status === 0, r.stderr.trim().slice(0, 200));
}

// Security scan — no network at runtime, no eval/new Function, no service
// worker, no cookies.
const allAppText = appFiles.map((f) => readFileSync(f.path, 'utf8')).join('\n');
const secChecks = [
  ['no eval(', !/\beval\s*\(/.test(allAppText)],
  ['no new Function', !/new\s+Function\s*\(/.test(allAppText)],
  ['no service worker', !/serviceWorker/.test(allAppText)],
  ['no document.cookie', !/document\.cookie/.test(allAppText)],
  ['no fetch of an absolute URL', !/fetch\(\s*['"]https?:/.test(allAppText)],
  ['no WebSocket', !/WebSocket/.test(allAppText)],
  ['no sendBeacon', !/sendBeacon/.test(allAppText)],
];
for (const [name, ok] of secChecks) check(`security: ${name}`, ok);

console.log(`\nGATECHECK: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
