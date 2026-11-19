// Boot: load the trophy list, wire the controls, and route between the
// checklist, one trophy's detail page, the roadmap and the missables page.
// The only network the app ever makes is fetching its own
// data/trophies.json from the same server that served this page.
import {
  DEMO_EARNED_IDS,
  buildExportData,
  downloadExport,
  loadEarned,
  loadSpoiler,
  parseImportData,
  saveEarned,
  saveSpoiler,
} from './store.js';
import { renderChecklist, renderDetail, renderMissables, renderRoadmap, renderStats } from './views.js';

const view = document.getElementById('view');
const statusLine = document.getElementById('statusLine');
const searchInput = document.getElementById('search');
const gradeFilter = document.getElementById('gradeFilter');
const kindFilter = document.getElementById('kindFilter');
const earnedFilter = document.getElementById('earnedFilter');
const missableOnly = document.getElementById('missableOnly');
const spoilerToggle = document.getElementById('spoilerToggle');

const filters = { search: '', grade: 'all', kind: 'all', earned: 'all', missableOnly: false, spoilerOn: loadSpoiler() };
let data = null;
let earned = loadEarned();

// Demo seeding for screenshots only: ?seed=13 marks 13 trophies earned the
// first time the page opens with that parameter, so the tracker shows a
// lived-in state. A normal visit never seeds anything.
const params = new URLSearchParams(location.search);
if (params.get('spoiler') === '1') {
  filters.spoilerOn = true;
  saveSpoiler(true);
}
spoilerToggle.checked = filters.spoilerOn;

function currentFilters() {
  return { ...filters };
}

function render() {
  if (!data) return;
  renderStats(data, earned);
  const hash = location.hash || '#/';
  const detail = hash.match(/^#\/trophy\/(\d+)$/);
  document.querySelectorAll('.tabs a').forEach((a) => {
    const route = a.getAttribute('data-route');
    a.classList.toggle('active', (!detail && hash === '#/' && route === 'checklist') || hash === `#/${route}`);
  });
  if (detail) {
    const trophy = data.trophies.find((t) => t.id === Number(detail[1]));
    if (trophy) renderDetail(view, data, trophy, earned, onToggle, filters.spoilerOn);
    else renderChecklist(view, data, earned, currentFilters(), onToggle);
  } else if (hash === '#/roadmap') {
    renderRoadmap(view, data, earned);
  } else if (hash === '#/missables') {
    renderMissables(view, data, earned, filters.spoilerOn);
  } else {
    renderChecklist(view, data, earned, currentFilters(), onToggle);
  }
}

function onToggle(name, checked) {
  if (checked) earned.add(name);
  else earned.delete(name);
  saveEarned(earned);
  render();
}

function say(message) {
  statusLine.textContent = message;
  if (message) setTimeout(() => { if (statusLine.textContent === message) statusLine.textContent = ''; }, 6000);
}

searchInput.addEventListener('input', () => { filters.search = searchInput.value; render(); });
gradeFilter.addEventListener('change', () => { filters.grade = gradeFilter.value; render(); });
kindFilter.addEventListener('change', () => { filters.kind = kindFilter.value; render(); });
earnedFilter.addEventListener('change', () => { filters.earned = earnedFilter.value; render(); });
missableOnly.addEventListener('change', () => { filters.missableOnly = missableOnly.checked; render(); });
spoilerToggle.addEventListener('change', () => {
  filters.spoilerOn = spoilerToggle.checked;
  saveSpoiler(filters.spoilerOn);
  say(filters.spoilerOn ? 'Spoiler mode on — story trophies stay hidden until you earn them.' : 'Spoiler mode off — all story trophies shown.');
  render();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  downloadExport(earned, filters.spoilerOn);
  say(`Exported ${earned.size} earned ${earned.size === 1 ? 'trophy' : 'trophies'} to leonida-ledger-progress.json.`);
});

document.getElementById('importFile').addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const { earned: imported, spoiler } = parseImportData(await file.text());
    const known = new Set(data.trophies.map((t) => t.name));
    const unknown = [...imported].filter((name) => !known.has(name));
    earned = new Set([...imported].filter((name) => known.has(name)));
    saveEarned(earned);
    if (spoiler !== null) {
      filters.spoilerOn = spoiler;
      spoilerToggle.checked = spoiler;
      saveSpoiler(spoiler);
    }
    say(`Imported ${earned.size} earned ${earned.size === 1 ? 'trophy' : 'trophies'}${unknown.length ? ` — ${unknown.length} unknown ${unknown.length === 1 ? 'name' : 'names'} skipped.` : '.'}`);
  } catch (error) {
    say(`Could not import that file: ${error.message}`);
  }
  event.target.value = '';
  render();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!earned.size) { say('Nothing to reset — no trophies earned yet.'); return; }
  if (window.confirm(`Clear all ${earned.size} earned ${earned.size === 1 ? 'trophy' : 'trophies'}? This cannot be undone — export first if you want a backup.`)) {
    earned = new Set();
    saveEarned(earned);
    say('Progress cleared.');
    render();
  }
});

window.addEventListener('hashchange', render);

const response = await fetch('data/trophies.json');
data = await response.json();
if (params.get('seed') === '13' && earned.size === 0) {
  for (const id of DEMO_EARNED_IDS) {
    const trophy = data.trophies.find((t) => t.id === id);
    if (trophy) earned.add(trophy.name);
  }
  saveEarned(earned);
}
render();

// A small handle for the end-to-end tests (tools/e2e.mjs): it exposes the
// same functions the buttons call, and nothing else.
window.__trophyGuide = {
  get earned() { return [...earned]; },
  get spoilerOn() { return filters.spoilerOn; },
  exportData: () => buildExportData(earned, filters.spoilerOn),
  importData: (text) => {
    const { earned: imported, spoiler } = parseImportData(text);
    earned = new Set([...imported].filter((name) => data.trophies.some((t) => t.name === name)));
    saveEarned(earned);
    if (spoiler !== null) { filters.spoilerOn = spoiler; spoilerToggle.checked = spoiler; saveSpoiler(spoiler); }
    render();
    return earned.size;
  },
  toggle: (name, checked) => onToggle(name, checked),
};
