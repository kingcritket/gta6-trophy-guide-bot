// Views: the checklist, one trophy's detail page, the roadmap and the
// missables page. Every trophy string reaches the page through textContent,
// never through HTML, so a name like "T**s Ass Drug Money" renders as-is
// and no guide text can break the page.
import { applyFilters, gradeCounts, isSpoilerHidden, KIND_LABELS } from './filters.js';

const GRADE_LABELS = { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function gradeTag(trophy) {
  const tag = el('span', `tag grade-${trophy.grade}`, GRADE_LABELS[trophy.grade]);
  return tag;
}

function kindTag(trophy) {
  return el('span', 'tag', KIND_LABELS[trophy.kind] || trophy.kind);
}

function missableTag() {
  return el('span', 'tag missable', '⚠ Missable');
}

function metaRow(trophy) {
  const row = el('div', 'trophy-meta');
  row.append(gradeTag(trophy), kindTag(trophy));
  if (trophy.missable) row.append(missableTag());
  if (trophy.target != null) row.append(el('span', 'tag', `Target: ${trophy.targetLabel || trophy.target}`));
  if (trophy.stage) row.append(el('span', 'tag', `Roadmap step ${trophy.stage}`));
  return row;
}

export function renderStats(data, earned) {
  document.getElementById('earnedCount').textContent = String(earned.size);
  const bar = document.getElementById('progressBar');
  const fill = document.getElementById('progressFill');
  const pct = Math.round((earned.size / data.trophies.length) * 100);
  fill.style.width = `${pct}%`;
  bar.setAttribute('aria-valuenow', String(earned.size));
  document.getElementById('progressNote').textContent =
    earned.size === 0
      ? 'Tick a trophy off and it stays ticked in this browser.'
      : earned.size === data.trophies.length
        ? 'Every trophy earned — you are a Leonida Legend.'
        : `${earned.size} of ${data.trophies.length} earned — ${pct}% of the way to the platinum.`;
  const counts = gradeCounts(data.trophies, earned);
  const list = document.getElementById('gradeStats');
  list.replaceChildren();
  for (const grade of ['platinum', 'gold', 'silver', 'bronze']) {
    const li = el('li');
    li.append(el('span', `medal ${grade}`));
    li.append(document.createTextNode(`${GRADE_LABELS[grade]} ${counts[grade][0]}/${counts[grade][1]}`));
    list.append(li);
  }
}

export function renderChecklist(view, data, earned, filters, onToggle) {
  view.replaceChildren();
  const shown = applyFilters(data.trophies, earned, filters);
  const count = el('p', 'result-count');
  const hiddenStory = data.trophies.filter((t) => isSpoilerHidden(t, earned, filters.spoilerOn)).length;
  count.textContent =
    shown.length === data.trophies.length
      ? `Showing all ${shown.length} trophies.` +
        (hiddenStory ? ` Spoiler mode is hiding ${hiddenStory} story ${hiddenStory === 1 ? 'trophy' : 'trophies'} — earn ${hiddenStory === 1 ? 'it' : 'them'} to reveal ${hiddenStory === 1 ? 'it' : 'them'}.` : '')
      : `Showing ${shown.length} of ${data.trophies.length} trophies.`;
  view.append(count);
  if (shown.length === 0) {
    view.append(el('p', 'empty', 'No trophies match these filters. Loosen a filter to see more.'));
    return;
  }
  const list = el('ul', 'trophy-list');
  list.id = 'rows';
  for (const t of shown) {
    const item = el('li', 'trophy' + (earned.has(t.name) ? ' earned' : ''));
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = earned.has(t.name);
    box.setAttribute('aria-label', `Earned: ${t.name}`);
    box.addEventListener('change', () => onToggle(t.name, box.checked));
    const body = el('div', 'trophy-body');
    const hidden = isSpoilerHidden(t, earned, filters.spoilerOn);
    if (hidden) {
      item.classList.add('spoiler-hidden');
      body.append(el('h3', 'trophy-name', '🔒 Hidden trophy — earn it to reveal'));
      body.append(el('p', 'trophy-desc', 'A story trophy. Its name and description stay hidden in spoiler mode until you earn it.'));
      body.append(el('p', 'trophy-guide', 'Guide hidden too — no spoilers here.'));
      body.append(metaRow({ ...t, name: 'Hidden trophy' }));
    } else {
      const name = el('h3', 'trophy-name', t.name);
      if (earned.has(t.name)) name.append(el('span', 'earned-mark', '✓ Earned'));
      body.append(name);
      body.append(el('p', 'trophy-desc', t.description));
      const guide = el('p', 'trophy-guide', t.guide.length > 180 ? `${t.guide.slice(0, 180)}… ` : t.guide);
      const more = el('a', 'more', 'Read the guide →');
      more.href = `#/trophy/${t.id}`;
      guide.append(more);
      body.append(guide);
      body.append(metaRow(t));
    }
    const grade = el('div', 'trophy-grade');
    grade.append(el('span', `medal ${t.grade}`));
    grade.append(el('strong', null, GRADE_LABELS[t.grade]));
    grade.append(document.createTextNode(hidden ? 'Story' : KIND_LABELS[t.kind] || ''));
    item.append(box, body, grade);
    list.append(item);
  }
  view.append(list);
}

function sourceList(data, trophy) {
  const list = el('ul', 'sources');
  for (const key of trophy.sources || []) {
    const source = data.sources[key];
    if (!source) continue;
    const li = el('li');
    if (source.url) {
      const a = el('a', null, source.label);
      a.href = source.url;
      a.target = '_blank';
      a.rel = 'noopener';
      li.append(a);
      if (source.note) li.append(document.createTextNode(` — ${source.note}`));
    } else {
      li.textContent = source.label;
      if (source.note) li.append(document.createTextNode(` — ${source.note}`));
    }
    list.append(li);
  }
  return list;
}

export function renderDetail(view, data, trophy, earned, onToggle, spoilerOn) {
  view.replaceChildren();
  const page = el('article', 'detail');
  const back = el('a', 'back', '← Back to the checklist');
  back.href = '#/';
  page.append(back);
  if (isSpoilerHidden(trophy, earned, spoilerOn)) {
    page.append(el('h2', null, '🔒 Hidden trophy'));
    page.append(el('p', 'official', 'A story trophy. Its name, description and guide stay hidden in spoiler mode until you earn it.'));
    page.append(metaRow(trophy));
    const earnRow = el('label', 'earn-row');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = false;
    box.addEventListener('change', () => onToggle(trophy.name, box.checked));
    earnRow.append(box, document.createTextNode('Mark as earned to reveal it'));
    page.append(earnRow);
    view.append(page);
    return;
  }
  page.append(el('h2', null, trophy.name));
  const official = el('p', 'official');
  official.append(document.createTextNode('Official description: '));
  official.append(el('strong', null, trophy.description));
  page.append(official);
  page.append(metaRow(trophy));
  page.append(el('h3', null, 'Guide'));
  page.append(el('p', 'guide-text', trophy.guide));
  page.append(el('h3', null, 'Sources'));
  page.append(sourceList(data, trophy));
  page.append(el('p', 'guide-text', 'The guide above is written for this ledger, in its own words. Where it states a count or a time, that number comes from the source named beside it; where it says “not yet known”, no source has pinned the detail down yet and the official description is all there is to go on.'));
  if (trophy.missable) {
    const warn = el('div', 'callout');
    warn.append(el('p', null, '⚠ Missable — read this first.'));
    warn.append(el('p', null, trophy.missableNote || ''));
    page.append(warn);
  }
  const earnRow = el('label', 'earn-row');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = earned.has(trophy.name);
  box.addEventListener('change', () => onToggle(trophy.name, box.checked));
  earnRow.append(box, document.createTextNode(earned.has(trophy.name) ? 'Earned — ticked off in your checklist.' : 'Mark as earned'));
  page.append(earnRow);
  view.append(page);
}

export function renderRoadmap(view, data, earned) {
  view.replaceChildren();
  const page = el('div', 'page');
  page.append(el('h2', null, 'Roadmap to the platinum'));
  const intro = el('p', null, 'One playthrough, about 200 hours, difficulty 4 out of 10 — that is PowerPyx’s verdict on the whole road to “Vice Got a Price!”. There are no online trophies, no difficulty settings and no mission replay, but free-roam continues after the story, so almost everything can be finished after the credits. The three steps below follow PowerPyx’s roadmap, in its order.');
  page.append(intro);
  const facts = el('div', 'fact-grid');
  const factData = [
    ['~200 hours', 'PowerPyx’s estimate to the platinum'],
    ['4 / 10', 'Estimated difficulty (PowerPyx)'],
    ['1 playthrough', 'No New Game+ needed; free-roam after the story'],
    ['5 chapters', 'Story length 60–80 hours (PowerPyx)'],
    ['0 online', 'All 55 trophies are offline, single-player'],
    ['1 missable', 'Only Positive Mental Attitude may be missable'],
  ];
  for (const [big, small] of factData) {
    const fact = el('div', 'fact');
    fact.append(el('strong', null, big));
    fact.append(el('span', null, small));
    facts.append(fact);
  }
  page.append(facts);

  const step1 = el('section', 'stage');
  step1.append(el('h3', null, 'Step 1 — Play the story, take the side roads '));
  step1.querySelector('h3').append(el('span', 'hours', '· 60–80 hours'));
  step1.append(el('p', null, 'Play the five chapters and take optional missions as they appear. Scan vehicles and study animals as you go — progress already counts toward the 100% checklist, even though the checklist itself only becomes viewable after the story (PowerPyx).'));
  const warn = el('div', 'callout');
  warn.append(el('p', null, '⚠ Do the first meditation in Chapter 1. Positive Mental Attitude — meditate at every spot across Leonida — is the only trophy PowerPyx flags as potentially missable, because the first meditation can be missed in Chapter 1.'));
  step1.append(warn);
  const list1 = el('ul');
  for (const text of [
    'Story trophies land as you finish chapters and named missions — 12 of the 55, from “Just Like Paradise” to the final mission.',
    'Say yes to stranger missions and character strands (Andy, Kenton, Billy, Randy, Tyrone, Bret) when they appear; they are long, so start early.',
    'Meditate at every spot you find (18 spots in 10 locations) — do not leave the first one for later.',
  ]) list1.append(el('li', null, text));
  step1.append(list1);
  page.append(step1);

  const step2 = el('section', 'stage');
  step2.append(el('h3', null, 'Step 2 — The 100% completion checklist '));
  step2.querySelector('h3').append(el('span', 'hours', '· about 100 hours'));
  step2.append(el('p', null, 'After the credits, open Progress > Stats > 100% Completion. PowerPyx stresses the checklist is lenient — closer to 60% true completion — and most of it is finished by chasing the other trophies.'));
  const list2 = el('ul');
  for (const text of [
    '70 of 80 challenges (any 50 unlock “One Last Thing”; you may skip the hardest 10).',
    '200 of 277 vehicles discovered and 100 of 255 animals studied — “Whip It Good” needs only 100 vehicles.',
    '50 of 66 weapons, 15 of 18 collectible card sets (any 3 sets unlock “Don’t Touch My Deck”), 300 stunts (“Cunning Stunts” needs 250 of 397).',
    'On the way: 100 WAiNK locations, gold in all 42 Shooting Range challenges, wins at all 14 Top Fun drone locations, 20 different races.',
  ]) list2.append(el('li', null, text));
  step2.append(list2);
  page.append(step2);

  const step3 = el('section', 'stage');
  step3.append(el('h3', null, 'Step 3 — Strangers, cleanup, platinum '));
  step3.querySelector('h3').append(el('span', 'hours', '· about 10 hours'));
  step3.append(el('p', null, 'Finish the 8 Strangers & Freaks strands and any character quests left over, then sweep up the miscellaneous trophies — partner robberies, the Ocean Beach cocktail, the showroom smash — and the economy ones: $250,000 laundered, $100,000 spent, all 8 garages, 10 Scooter Bros registrations. “A Long Road” (100%) and then the platinum follow.'));
  const safe = el('div', 'callout safe');
  safe.append(el('p', null, '✓ Cheats off. Both PowerPyx and the guide sites note that cheats disable trophies and saving — leave them off for the whole run.'));
  step3.append(safe);
  page.append(step3);

  const sources = el('p', null, 'Roadmap facts: ');
  const a = el('a', null, 'PowerPyx — GTA 6 Trophy Guide & Roadmap');
  a.href = 'https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/';
  a.target = '_blank';
  a.rel = 'noopener';
  sources.append(a, document.createTextNode(' (difficulty, time, missable warning, 100% counts, no mission replay). Trophy names and descriptions: the official list on Exophase and PSNProfiles.'));
  page.append(sources);
  view.append(page);
}

export function renderMissables(view, data, earned, spoilerOn) {
  view.replaceChildren();
  const page = el('div', 'page');
  page.append(el('h2', null, 'Missable trophies'));
  page.append(el('p', null, 'The short version is good news: according to PowerPyx, only one trophy in the whole list may be missable. The rest unlock through story progress, free-roam activities or things you can repeat after the credits — there is no mission replay, but free-roam continues after the story, so a trophy tied to a mission you already finished is not lost.'));
  const flagged = data.trophies.filter((t) => t.missable);
  for (const t of flagged) {
    const warn = el('div', 'callout');
    warn.append(el('p', null, `⚠ ${t.name} — ${t.grade}`));
    warn.append(el('p', null, t.missableNote || ''));
    const link = el('a', null, 'Read the full guide →');
    link.href = `#/trophy/${t.id}`;
    warn.append(link);
    page.append(warn);
  }
  const safe = el('div', 'callout safe');
  safe.append(el('p', null, '✓ Everything else: safe.'));
  safe.append(el('p', null, 'The 12 story trophies (chapters 1–4, the named missions, the final mission) unlock by playing the story — they cannot be missed while the story is in front of you, and the game keeps free-roam open after the credits. The side strands, collectibles, activities, crime and economy trophies are all repeatable or still available after the story. One caution still applies to the whole list: cheats disable trophies, so keep them off.'));
  page.append(safe);
  const story = data.trophies.filter((t) => t.kind === 'story');
  page.append(el('h3', null, 'Story trophies — do them as the story runs'));
  const list = el('ul');
  for (const t of story) {
    const li = el('li');
    if (isSpoilerHidden(t, earned, spoilerOn)) {
      li.append(document.createTextNode('🔒 Hidden trophy — earn it to reveal'));
    } else {
      li.append(document.createTextNode(`${t.name} — ${t.description} `));
      const link = el('a', null, 'Guide →');
      link.href = `#/trophy/${t.id}`;
      li.append(link);
      if (earned.has(t.name)) li.append(document.createTextNode(' ✓ Earned'));
    }
    list.append(li);
  }
  page.append(list);
  const sources = el('p', null, 'Missable verdict: ');
  const a = el('a', null, 'PowerPyx — GTA 6 Trophy Guide & Roadmap');
  a.href = 'https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/';
  a.target = '_blank';
  a.rel = 'noopener';
  sources.append(a, document.createTextNode(' (“Number of missable trophies: Potentially 1 — Positive Mental Attitude”).'));
  page.append(sources);
  view.append(page);
}
