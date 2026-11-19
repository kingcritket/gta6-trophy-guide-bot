// Verify app/data/trophies.json against the kit starter's official list.
const fs = require('node:fs');
const mine = JSON.parse(fs.readFileSync('app/data/trophies.json', 'utf8'));
const kit = JSON.parse(fs.readFileSync(process.env.KIT_TROPHIES, 'utf8'));
const norm = (s) => s.normalize('NFKC')
  .replace(/[‘’]/g, "'").replace(/[–—−]/g, '-').replace(/…/g, '...')
  .replace(/\s+/g, ' ').toLowerCase();
const kitNames = new Map(kit.trophies.map((t) => [norm(t.name), t]));
const bad = [];
for (const t of mine.trophies) {
  const k = kitNames.get(norm(t.name));
  if (!k) bad.push('NAME NOT IN KIT: ' + t.name);
  else if (k.description !== t.description) bad.push('DESC DIFF: ' + t.name);
  else if (k.grade !== t.grade) bad.push('GRADE DIFF: ' + t.name);
  if (!t.guide || !t.guide.trim()) bad.push('BLANK GUIDE: ' + t.name);
  if (!t.kind || !t.sources || !t.sources.length) bad.push('MISSING META: ' + t.name);
}
const missing = kit.trophies.filter((t) => !mine.trophies.some((m) => norm(m.name) === norm(t.name))).map((t) => t.name);
console.log('count:', mine.trophies.length, '| kit count:', kit.trophies.length);
console.log('missing from mine:', missing.length ? missing : 'NONE');
console.log('mismatches:', bad.length ? bad : 'NONE');
const kinds = {};
mine.trophies.forEach((t) => { kinds[t.kind] = (kinds[t.kind] || 0) + 1; });
console.log('kinds:', JSON.stringify(kinds));
console.log('missable:', JSON.stringify(mine.trophies.filter((t) => t.missable).map((t) => t.name)));
console.log('stages:', JSON.stringify(mine.trophies.reduce((a, t) => { a[t.stage] = (a[t.stage] || 0) + 1; return a; }, {})));
console.log('grades:', JSON.stringify(mine.trophies.reduce((a, t) => { a[t.grade] = (a[t.grade] || 0) + 1; return a; }, {})));
console.log('with target:', mine.trophies.filter((t) => t.target != null).length);
console.log('file bytes:', fs.statSync('app/data/trophies.json').size);
console.log('sources cited:', JSON.stringify([...new Set(mine.trophies.flatMap((t) => t.sources))]));
if (bad.length || missing.length || mine.trophies.length !== 55) process.exit(1);
