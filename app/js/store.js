// Progress store: the earned set and the spoiler setting live in
// localStorage, so a checklist survives reloads. Export writes the same
// state to a JSON file; import reads one back and replaces the state.
// Nothing here touches the network.
export const EARNED_KEY = 'leonida-ledger-earned-v1';
export const SPOILER_KEY = 'leonida-ledger-spoiler-v1';

// The demo set used only when the page is opened with ?seed=13, so the
// screenshots show a lived-in tracker (13 of 55 earned). A normal visit
// never seeds anything.
export const DEMO_EARNED_IDS = [2, 3, 4, 5, 8, 9, 10, 15, 16, 19, 21, 35, 46];

export function loadEarned() {
  try {
    const raw = localStorage.getItem(EARNED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((name) => typeof name === 'string'));
  } catch {
    return new Set();
  }
}

export function saveEarned(earned) {
  localStorage.setItem(EARNED_KEY, JSON.stringify([...earned]));
}

export function loadSpoiler() {
  return localStorage.getItem(SPOILER_KEY) === '1';
}

export function saveSpoiler(on) {
  localStorage.setItem(SPOILER_KEY, on ? '1' : '0');
}

// The exact bytes export writes, and the exact shape import accepts, so a
// round trip (export, then import the file) restores the same state.
export function buildExportData(earned, spoiler) {
  return {
    app: 'leonida-ledger',
    version: 1,
    exportedAt: new Date().toISOString(),
    spoiler: Boolean(spoiler),
    earned: [...earned].sort(),
  };
}

export function parseImportData(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('Not a progress file.');
  // Accept both our own export shape and a bare array of trophy names.
  const names = Array.isArray(data) ? data : data.earned;
  if (!Array.isArray(names)) throw new Error('Not a progress file: no earned list.');
  const earned = new Set();
  for (const name of names) {
    if (typeof name !== 'string' || !name.trim()) throw new Error('Not a progress file: bad trophy name.');
    earned.add(name);
  }
  const spoiler = Array.isArray(data) ? null : data.spoiler === true;
  return { earned, spoiler };
}

export function downloadExport(earned, spoiler) {
  const blob = new Blob([JSON.stringify(buildExportData(earned, spoiler), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leonida-ledger-progress.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
