// Filtering and the spoiler rule: which trophies a view shows, and what a
// hidden one looks like. Pure functions over the trophy list — no DOM, no
// storage — so the same rules drive the checklist, the counts and the tests.

// Kinds the kind filter offers, in filter order.
export const KINDS = ['story', 'side', 'collectibles', 'activities', 'crime', 'economy', 'misc', 'completion'];

export const KIND_LABELS = {
  story: 'Story',
  side: 'Side missions',
  collectibles: 'Collectibles',
  activities: 'Activities',
  crime: 'Crime',
  economy: 'Economy',
  misc: 'Miscellaneous',
  completion: 'Completion & platinum',
};

// A story trophy is a spoiler while it is unearned and spoiler mode is on.
export function isSpoilerHidden(trophy, earned, spoilerOn) {
  return spoilerOn && trophy.kind === 'story' && !earned.has(trophy.name);
}

export function applyFilters(trophies, earned, filters) {
  const query = (filters.search || '').trim().toLowerCase();
  return trophies.filter((t) => {
    if (filters.grade !== 'all' && t.grade !== filters.grade) return false;
    if (filters.kind !== 'all' && t.kind !== filters.kind) return false;
    if (filters.missableOnly && !t.missable) return false;
    if (filters.earned === 'earned' && !earned.has(t.name)) return false;
    if (filters.earned === 'remaining' && earned.has(t.name)) return false;
    if (query) {
      const haystack = `${t.name} ${t.description} ${t.guide} ${KIND_LABELS[t.kind] || ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function gradeCounts(trophies, earned) {
  const counts = { platinum: [0, 0], gold: [0, 0], silver: [0, 0], bronze: [0, 0] };
  for (const t of trophies) {
    counts[t.grade][1] += 1;
    if (earned.has(t.name)) counts[t.grade][0] += 1;
  }
  return counts;
}

export function kindCounts(trophies, earned) {
  const counts = {};
  for (const kind of KINDS) counts[kind] = [0, 0];
  for (const t of trophies) {
    counts[t.kind][1] += 1;
    if (earned.has(t.name)) counts[t.kind][0] += 1;
  }
  return counts;
}
