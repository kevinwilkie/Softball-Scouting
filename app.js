/* =========================================================================
   Carrollton Softball — Pitcher Scouting App
   Single-file vanilla JS SPA. State persisted to localStorage so it works
   offline at the field. Three tabs: Roster, Log Game, Stats.
   ========================================================================= */

'use strict';

/* ----------------------------- Constants ------------------------------- */

const CLASSIFICATIONS = ['Freshman', 'Sophomore', 'Junior', 'Senior'];

const PITCH_TYPES = [
  'Fastball', 'Changeup', 'Curveball', 'Riseball',
  'Dropball', 'Screwball', 'Drop Curve', 'Knuckle'
];

// Short labels for compact tendency cells.
const PITCH_ABBR = {
  Fastball: 'FB', Changeup: 'CH', Curveball: 'CB', Riseball: 'RB',
  Dropball: 'DB', Screwball: 'SC', 'Drop Curve': 'DC', Knuckle: 'KN'
};
const abbr = name => PITCH_ABBR[name] || (name || '?').slice(0, 2).toUpperCase();

const BATS = ['R', 'L', 'S']; // right / left / switch
const BATS_LABEL = { R: 'Bats R', L: 'Bats L', S: 'Switch' };
const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DP', 'FLEX', 'UTIL'];

// Plate-appearance outcomes for my hitters. ab = counts as an at-bat;
// hit = base hit; ob = reaches base (for OBP); tb = total bases.
const AB_RESULTS = [
  { id: '1B',  label: 'Single',     ab: true,  hit: true,  ob: true,  tb: 1, tone: 'hit' },
  { id: '2B',  label: 'Double',     ab: true,  hit: true,  ob: true,  tb: 2, tone: 'hit' },
  { id: '3B',  label: 'Triple',     ab: true,  hit: true,  ob: true,  tb: 3, tone: 'hit' },
  { id: 'HR',  label: 'Home Run',   ab: true,  hit: true,  ob: true,  tb: 4, tone: 'hit' },
  { id: 'BB',  label: 'Walk',       ab: false, hit: false, ob: true,  tb: 0, tone: 'ball' },
  { id: 'HBP', label: 'HBP',        ab: false, hit: false, ob: true,  tb: 0, tone: 'ball' },
  { id: 'K',   label: 'Strikeout',  ab: true,  hit: false, ob: false, tb: 0, tone: 'strike' },
  { id: 'OUT', label: 'Out',        ab: true,  hit: false, ob: false, tb: 0, tone: 'out' },
  { id: 'FC',  label: "Fielder's Choice", ab: true, hit: false, ob: false, tb: 0, tone: 'out' },
  { id: 'ROE', label: 'Reached on Error', ab: true, hit: false, ob: false, tb: 0, tone: 'out' },
  { id: 'SAC', label: 'Sacrifice',  ab: false, hit: false, ob: false, tb: 0, tone: 'out' },
];
const AB_BY_ID = Object.fromEntries(AB_RESULTS.map(r => [r.id, r]));

// Aggregate a hitting line from a set of at-bats.
function hittingLine(atbats) {
  let ab = 0, h = 0, bb = 0, hbp = 0, k = 0, tb = 0, rbi = 0, d2 = 0, t3 = 0, hr = 0, ob = 0;
  atbats.forEach(a => {
    const r = AB_BY_ID[a.result];
    if (!r) return;
    if (r.ab) ab++;
    if (r.hit) h++;
    if (r.ob) ob++;
    if (a.result === 'BB') bb++;
    if (a.result === 'HBP') hbp++;
    if (a.result === 'K') k++;
    if (a.result === '2B') d2++;
    if (a.result === '3B') t3++;
    if (a.result === 'HR') hr++;
    tb += r.tb;
    rbi += (+a.rbi || 0);
  });
  const obDen = ab + bb + hbp; // approximates AB + BB + HBP + SF
  const avg = ab ? h / ab : 0;
  const obp = obDen ? ob / obDen : 0;
  const slg = ab ? tb / ab : 0;
  const fmt = n => n.toFixed(3).replace(/^0/, '');
  return {
    pa: atbats.length, ab, h, bb, hbp, k, tb, rbi, d2, t3, hr,
    avg: ab ? fmt(avg) : '—', obp: obDen ? fmt(obp) : '—', slg: ab ? fmt(slg) : '—',
    ops: (ab || obDen) ? fmt(obp + slg) : '—'
  };
}

function hitterAtBats(hitterId) {
  return (state.atbats || []).filter(a => a.hitterId === hitterId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// 13-zone model. Inner 1-9 are the 3x3 strike zone (matches the screenshot),
// outer 11-14 are the four "ball" quadrants just off the plate. Each entry
// maps a zone id to a CSS grid cell area.
const ZONES = [
  // outer top corners
  { id: 11, kind: 'ball',   col: '1 / 4', row: '1 / 2', label: '' },
  { id: 12, kind: 'ball',   col: '4 / 6', row: '1 / 2', label: '' },
  // strike zone rows
  { id: 1, kind: 'strike',  col: '2 / 3', row: '2 / 3' },
  { id: 2, kind: 'strike',  col: '3 / 4', row: '2 / 3' },
  { id: 3, kind: 'strike',  col: '4 / 5', row: '2 / 3' },
  { id: 4, kind: 'strike',  col: '2 / 3', row: '3 / 4' },
  { id: 5, kind: 'strike',  col: '3 / 4', row: '3 / 4' },
  { id: 6, kind: 'strike',  col: '4 / 5', row: '3 / 4' },
  { id: 7, kind: 'strike',  col: '2 / 3', row: '4 / 5' },
  { id: 8, kind: 'strike',  col: '3 / 4', row: '4 / 5' },
  { id: 9, kind: 'strike',  col: '4 / 5', row: '4 / 5' },
  // left/right outer columns
  { id: 13, kind: 'ball',   col: '1 / 2', row: '2 / 5', label: '' },
  { id: 14, kind: 'ball',   col: '5 / 6', row: '2 / 5', label: '' },
  // outer bottom corners
  { id: 15, kind: 'ball',   col: '1 / 4', row: '5 / 6', label: '' },
  { id: 16, kind: 'ball',   col: '4 / 6', row: '5 / 6', label: '' },
];

// Pitch result outcomes. `group` drives the entry-sheet layout ("no contact"
// vs "ball in play"); the count and stat logic key off `id`.
const RESULTS = [
  // No contact / count results
  { id: 'ball',          label: 'Ball',          tone: 'ball',   group: 'nc' },
  { id: 'called_strike', label: 'Called Strike', tone: 'strike', group: 'nc' },
  { id: 'swing_strike',  label: 'Swing & Miss',  tone: 'strike', group: 'nc' },
  { id: 'foul',          label: 'Foul',          tone: 'foul',   group: 'nc' },
  { id: 'hbp',           label: 'Hit By Pitch',  tone: 'ball',   group: 'nc' },
  // Ball put in play
  { id: 'in_play_out',   label: 'Out',           tone: 'out',    group: 'ip' },
  { id: 'single',        label: 'Single',        tone: 'hit',    group: 'ip' },
  { id: 'double',        label: 'Double',        tone: 'hit',    group: 'ip' },
  { id: 'triple',        label: 'Triple',        tone: 'hit',    group: 'ip' },
  { id: 'hr',            label: 'Home Run',      tone: 'hit',    group: 'ip' },
];

// Result classification sets (used by count logic and stats). 'hit' is a
// legacy id from before extra-base detail; it's treated as a generic hit.
const HIT_RESULTS     = ['single', 'double', 'triple', 'hr', 'hit'];
const IN_PLAY_RESULTS = HIT_RESULTS.concat(['in_play_out']);
const SWING_RESULTS   = IN_PLAY_RESULTS.concat(['swing_strike', 'foul']);

const RESULT_TONE = {
  ball: 'res-ball', called_strike: 'res-strike', swing_strike: 'res-strike',
  foul: 'res-foul', in_play_out: 'res-out', hbp: 'res-ball',
  single: 'res-hit', double: 'res-hit', triple: 'res-hit', hr: 'res-hit', hit: 'res-hit'
};
const RESULT_LABEL = Object.assign(
  Object.fromEntries(RESULTS.map(r => [r.id, r.label])),
  { hit: 'Hit' }
);

/* ----------------------------- State / storage ------------------------- */

const STORE_KEY = 'chs-softball-scout-v1';

const defaultState = () => ({
  pitchers: [],     // {id, name, classification, hand, pitches:[], opponentId?}
  hitters: [],      // {id, name, bats, number, position}  (Carrollton's hitters)
  opponents: [],    // {id, name, players:[{id, name, bats, number, position, isPitcher}]}
  schedule: [],     // {id, date, time, opponentId, opponentName, homeAway, location, notes, gameId}
  atbats: [],       // {id, hitterId, date, opponentId, opponentName, result, rbi}  (my hitters' offense)
  games: [],        // {id, date, opponentId, pitcherId, pitches:[...], ...lineups}
  activeGameId: null,
  ui: { tab: 'pitchers', statsPitcherId: null, statsGameId: null }
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = Object.assign(defaultState(), JSON.parse(raw));
      // Migrations for data saved by earlier versions.
      if (!Array.isArray(s.hitters)) s.hitters = [];
      if (!Array.isArray(s.opponents)) s.opponents = [];
      if (!Array.isArray(s.schedule)) s.schedule = [];
      if (!Array.isArray(s.atbats)) s.atbats = [];
      if (s.ui && s.ui.tab === 'roster') s.ui.tab = 'pitchers';
      return s;
    }
  } catch (e) { console.warn('load failed', e); }
  return defaultState();
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('save failed', e); }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ----------------------------- Helpers --------------------------------- */

const $ = sel => document.querySelector(sel);
const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null || c === false) return;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return n;
};

const pitcherById = id => state.pitchers.find(p => p.id === id);
const hitterById = id => state.hitters.find(h => h.id === id);
const opponentById = id => state.opponents.find(o => o.id === id);
const activeGame = () => state.games.find(g => g.id === state.activeGameId) || null;

// Resolve a lineup-slot player id to a player record. `me` => Carrollton's
// hitters; `opp` => the selected opponent's roster.
function lineupPlayer(g, side, id) {
  if (side === 'me') return hitterById(id);
  const opp = opponentById(g.opponentId);
  return opp ? (opp.players || []).find(p => p.id === id) : null;
}

// The lineup array (ordered player ids) for a side in a game.
function lineupFor(g, side) {
  return (side === 'me' ? g.myLineup : g.oppLineup) || [];
}

// Current batter for the game: derived from batting side + that side's index.
function currentBatter(g) {
  const side = g.battingSide || 'me';
  const lineup = lineupFor(g, side);
  if (!lineup.length) return null;
  const idx = ((side === 'me' ? g.myIdx : g.oppIdx) || 0) % lineup.length;
  const player = lineupPlayer(g, side, lineup[idx]);
  return player ? { player, side, slot: idx + 1 } : null;
}

function toast(msg) {
  const t = el('div', { class: 'toast', text: msg });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1600);
}

function fmtClass(c) {
  const map = { Freshman: 'Fr.', Sophomore: 'So.', Junior: 'Jr.', Senior: 'Sr.' };
  return map[c] || c;
}

/* ----------------------------- Routing --------------------------------- */

function setTab(tab) {
  state.ui.tab = tab;
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  render();
  save();
}

document.querySelectorAll('.tab-btn').forEach(b =>
  b.addEventListener('click', () => setTab(b.dataset.tab)));

function render() {
  const root = $('#view-root');
  root.innerHTML = '';
  const views = {
    pitchers: renderRoster,
    hitters: renderHitters,
    opponents: renderOpponents,
    schedule: renderSchedule,
    game: renderGame,
    stats: renderStats
  };
  root.appendChild((views[state.ui.tab] || renderRoster)());
  window.scrollTo(0, 0);
}

/* ============================ ROSTER TAB =============================== */

function renderRoster() {
  if (state.ui.openPitcherId) {
    const p = pitcherById(state.ui.openPitcherId);
    if (p) return renderPitcherProfile(p);
    state.ui.openPitcherId = null;
  }

  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'section-head' }, [
    el('h2', { text: 'Pitchers' }),
    el('button', { class: 'btn btn-primary btn-sm', onclick: () => openPitcherForm() }, '+ Add Pitcher')
  ]));

  if (state.pitchers.length === 0) {
    wrap.appendChild(el('div', { class: 'empty' }, [
      el('p', { text: '⚾' }),
      el('p', { text: 'No pitchers yet.' }),
      el('p', { class: 'muted', text: 'Add the opposing pitchers you want to scout.' })
    ]));
    return wrap;
  }

  state.pitchers.forEach(p => wrap.appendChild(pitcherCard(p)));
  return wrap;
}

function pitcherCard(p) {
  const initials = p.name.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const nGames = pitcherGames(p.id).length;
  return el('div', { class: 'card card-tappable', onclick: () => openPitcherProfile(p) }, [
    el('div', { class: 'pitcher-card' }, [
      el('div', { class: `pitcher-num hand-${p.hand}`, text: initials || '?' }),
      el('div', { class: 'pitcher-info' }, [
        el('h3', { text: p.name }),
        el('div', { class: 'pitcher-meta',
          text: `${p.classification ? fmtClass(p.classification) + ' · ' : ''}${p.hand === 'L' ? 'Left-handed' : 'Right-handed'}` }),
        p.opponentId && opponentById(p.opponentId)
          ? el('div', { class: 'pitcher-meta muted', text: opponentById(p.opponentId).name })
          : null,
        p.pitches && p.pitches.length
          ? el('div', { class: 'pitch-tags' }, p.pitches.map(pt => el('span', { class: 'pitch-tag', text: pt })))
          : el('div', { class: 'pitcher-meta muted', text: 'No pitches recorded' })
      ]),
      el('div', { class: 'card-chevron' }, [
        nGames ? el('span', { class: 'card-count', text: `${nGames} G` }) : null,
        el('span', { text: '›' })
      ])
    ])
  ]);
}

function deletePitcher(p) {
  if (!confirm(`Delete ${p.name}? Their logged games will also be removed.`)) return;
  state.pitchers = state.pitchers.filter(x => x.id !== p.id);
  state.games = state.games.filter(g => g.pitcherId !== p.id);
  if (activeGame() && activeGame().pitcherId === p.id) state.activeGameId = null;
  save();
  render();
}

function openPitcherForm(existing) {
  const draft = existing
    ? JSON.parse(JSON.stringify(existing))
    : { id: uid(), name: '', classification: 'Freshman', hand: 'R', pitches: [] };

  const nameInput = el('input', { type: 'text', value: draft.name, placeholder: 'e.g. Jordan Smith', autocomplete: 'off' });

  const classSelect = el('select', {},
    CLASSIFICATIONS.map(c => el('option', { value: c, selected: c === draft.classification }, c)));

  const handSeg = el('div', { class: 'segmented' }, ['R', 'L'].map(h =>
    el('div', {
      class: 'chip' + (draft.hand === h ? ' selected' : ''),
      onclick: e => {
        draft.hand = h;
        handSeg.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
      }
    }, h === 'R' ? 'Right-handed' : 'Left-handed')));

  const pitchGroup = el('div', { class: 'chip-group' }, PITCH_TYPES.map(pt =>
    el('div', {
      class: 'chip' + (draft.pitches.includes(pt) ? ' selected' : ''),
      onclick: e => {
        const i = draft.pitches.indexOf(pt);
        if (i >= 0) draft.pitches.splice(i, 1); else draft.pitches.push(pt);
        e.currentTarget.classList.toggle('selected');
      }
    }, pt)));

  const oppSelect = el('select', { onchange: e => draft.opponentId = e.target.value || null }, [
    el('option', { value: '' }, '— None —'),
    ...state.opponents.map(o => el('option', { value: o.id, selected: o.id === draft.opponentId }, o.name))
  ]);

  const body = el('div', {}, [
    el('h3', { text: existing ? 'Edit Pitcher' : 'Add Pitcher' }),
    el('div', { class: 'field' }, [el('label', { text: 'Name' }), nameInput]),
    el('div', { class: 'field' }, [el('label', { text: 'Classification' }), classSelect]),
    el('div', { class: 'field' }, [el('label', { text: 'Handedness' }), handSeg]),
    el('div', { class: 'field' }, [el('label', { text: 'Team / Opponent' }), oppSelect]),
    el('div', { class: 'field' }, [el('label', { text: 'Pitch Types' }), pitchGroup]),
    el('div', { style: { display: 'flex', gap: '10px', marginTop: '8px' } }, [
      el('button', { class: 'btn btn-block', onclick: closeModal }, 'Cancel'),
      el('button', { class: 'btn btn-primary btn-block', onclick: () => {
        draft.name = nameInput.value.trim();
        if (!draft.name) { toast('Enter a name'); return; }
        draft.classification = classSelect.value;
        const idx = state.pitchers.findIndex(p => p.id === draft.id);
        if (idx >= 0) state.pitchers[idx] = draft; else state.pitchers.push(draft);
        save(); closeModal(); render();
      } }, 'Save')
    ])
  ]);

  openModal(body);
}

/* ======================= MY TEAM (HITTERS) TAB ======================== */

function renderHitters() {
  if (state.ui.openHitterId) {
    const h = hitterById(state.ui.openHitterId);
    if (h) return renderHitterProfile(h);
    state.ui.openHitterId = null;
  }

  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'section-head' }, [
    el('h2', { text: 'My Hitters' }),
    el('div', {}, [
      state.hitters.length ? el('button', { class: 'btn btn-sm', onclick: () => openAtBatForm() }, '+ Log AB') : null,
      el('button', { class: 'btn btn-primary btn-sm', style: { marginLeft: '8px' }, onclick: () => openHitterForm() }, '+ Add')
    ])
  ]));

  if (state.hitters.length === 0) {
    wrap.appendChild(el('div', { class: 'empty' }, [
      el('p', { text: '🥎' }),
      el('p', { text: 'No hitters yet.' }),
      el('p', { class: 'muted', text: "Add Carrollton's hitters so you can set the lineup and track their hitting stats." })
    ]));
    return wrap;
  }

  state.hitters.forEach(h => {
    const line = hittingLine(hitterAtBats(h.id));
    wrap.appendChild(el('div', { class: 'card card-tappable', onclick: () => { state.ui.openHitterId = h.id; save(); render(); } }, [
      el('div', { class: 'pitcher-card' }, [
        el('div', { class: `pitcher-num hand-${h.bats === 'L' ? 'L' : 'R'}`, text: h.number ? `#${h.number}` : (h.name[0] || '?').toUpperCase() }),
        el('div', { class: 'pitcher-info' }, [
          el('h3', { text: h.name }),
          el('div', { class: 'pitcher-meta', text: [BATS_LABEL[h.bats] || 'Bats R', h.position || null].filter(Boolean).join(' · ') }),
          el('div', { class: 'pitcher-meta muted', text: line.pa ? `${line.avg} AVG · ${line.h}-${line.ab} · ${line.hr} HR` : 'No at-bats logged' })
        ]),
        el('div', { class: 'card-chevron' }, [
          line.pa ? el('span', { class: 'card-count', text: `${line.pa} PA` }) : null,
          el('span', { text: '›' })
        ])
      ])
    ]));
  });
  return wrap;
}

function renderHitterProfile(h) {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'section-head' }, [
    el('button', { class: 'btn btn-sm', onclick: () => { state.ui.openHitterId = null; save(); render(); } }, '‹ Back'),
    el('div', {}, [
      el('button', { class: 'btn btn-sm btn-primary', onclick: () => openAtBatForm(h.id) }, '+ Log AB'),
      el('button', { class: 'btn btn-sm', style: { marginLeft: '8px' }, onclick: () => openHitterForm(h) }, 'Edit'),
      el('button', { class: 'btn btn-sm btn-danger', style: { marginLeft: '8px' }, onclick: () => deleteHitter(h) }, 'Delete')
    ])
  ]));

  wrap.appendChild(el('div', { class: 'profile-head' }, [
    el('div', { class: `profile-badge hand-${h.bats === 'L' ? 'L' : 'R'}`, text: h.number ? `#${h.number}` : (h.name[0] || '?').toUpperCase() }),
    el('div', {}, [
      el('h2', { style: { margin: 0 }, text: h.name }),
      el('div', { class: 'muted', text: [BATS_LABEL[h.bats] || 'Bats R', h.position || null].filter(Boolean).join(' · ') })
    ])
  ]));

  const abs = hitterAtBats(h.id);
  const line = hittingLine(abs);
  wrap.appendChild(el('div', { class: 'card' }, [
    el('h3', { text: 'Season Hitting', style: { margin: '0 0 8px' } }),
    el('div', { class: 'line-grid' }, [
      lineStat('AVG', line.avg), lineStat('OBP', line.obp), lineStat('SLG', line.slg), lineStat('OPS', line.ops),
      lineStat('AB', line.ab), lineStat('H', line.h), lineStat('HR', line.hr), lineStat('RBI', line.rbi),
      lineStat('BB', line.bb), lineStat('K', line.k), lineStat('2B', line.d2), lineStat('3B', line.t3)
    ])
  ]));

  if (!abs.length) {
    wrap.appendChild(el('div', { class: 'empty' }, [
      el('p', { text: 'No at-bats logged.' }),
      el('button', { class: 'btn btn-primary', onclick: () => openAtBatForm(h.id) }, 'Log an At-Bat')
    ]));
    return wrap;
  }

  const log = el('div', { class: 'card' }, [el('h3', { text: 'At-Bat Log', style: { margin: '0 0 6px' } })]);
  abs.forEach(a => {
    const r = AB_BY_ID[a.result];
    log.appendChild(el('div', { class: 'ab-row' }, [
      el('span', { class: `log-pill res-${r ? r.tone : 'out'}`, text: a.result }),
      el('div', { class: 'ab-info' }, [
        el('div', { text: `${r ? r.label : a.result}${a.rbi ? ` · ${a.rbi} RBI` : ''}` }),
        el('div', { class: 'log-sub', text: `${a.date}${a.opponentName || (a.opponentId && opponentById(a.opponentId)?.name) ? ' · vs ' + (a.opponentName || opponentById(a.opponentId).name) : ''}` })
      ]),
      el('button', { class: 'log-del', onclick: () => { state.atbats = state.atbats.filter(x => x.id !== a.id); save(); render(); } }, '×')
    ]));
  });
  wrap.appendChild(log);
  return wrap;
}

// Quick at-bat entry. hitterId optional (preselected when from a profile).
function openAtBatForm(hitterId) {
  if (!state.hitters.length) { toast('Add a hitter first'); return; }
  const draft = { id: uid(), hitterId: hitterId || state.hitters[0].id, date: todayISO(), opponentId: null, opponentName: '', result: null, rbi: 0 };

  const hitterSelect = el('select', { onchange: e => draft.hitterId = e.target.value }, state.hitters.map(h =>
    el('option', { value: h.id, selected: h.id === draft.hitterId }, `${h.number ? '#' + h.number + ' ' : ''}${h.name}`)));
  const dateInput = el('input', { type: 'date', value: draft.date });
  const oppSelect = el('select', { onchange: e => draft.opponentId = e.target.value || null }, [
    el('option', { value: '' }, '— Opponent (optional) —'),
    ...state.opponents.map(o => el('option', { value: o.id }, o.name))
  ]);

  const rbiVal = el('span', { class: 'rbi-num', text: '0' });
  const setRbi = d => { draft.rbi = Math.max(0, draft.rbi + d); rbiVal.textContent = String(draft.rbi); };

  function commit(resultId) {
    draft.result = resultId;
    draft.hitterId = hitterSelect.value;
    draft.date = dateInput.value;
    draft.opponentId = oppSelect.value || null;
    state.atbats.push(draft);
    save(); closeModal(); render();
    const hn = hitterById(draft.hitterId);
    toast(`${hn ? hn.name : 'AB'} · ${AB_BY_ID[resultId].label}`);
  }

  const resGrid = el('div', { class: 'opt-grid cols-3' }, AB_RESULTS.map(r =>
    el('div', { class: `opt tone-${r.tone}`, onclick: () => commit(r.id) }, r.label)));

  openModal(el('div', {}, [
    el('div', { class: 'sheet-handle' }),
    el('h3', { text: 'Log At-Bat' }),
    el('div', { class: 'field' }, [el('label', { text: 'Hitter' }), hitterSelect]),
    el('div', { class: 'row-2' }, [
      el('div', { class: 'field' }, [el('label', { text: 'Date' }), dateInput]),
      el('div', { class: 'field' }, [el('label', { text: 'Opponent' }), oppSelect])
    ]),
    el('div', { class: 'field' }, [
      el('label', { text: 'RBI' }),
      el('div', { class: 'rbi-stepper' }, [
        el('button', { class: 'score-btn', onclick: () => setRbi(-1) }, '−'),
        rbiVal,
        el('button', { class: 'score-btn', onclick: () => setRbi(1) }, '+')
      ])
    ]),
    el('div', { class: 'sheet-section-label', text: 'Result (tap to save)' }),
    resGrid,
    el('button', { class: 'btn btn-block', style: { marginTop: '14px' }, onclick: closeModal }, 'Cancel')
  ]));
}

// Shared card for a hitter / opponent player.
function playerCard(pl, onEdit, onDelete) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'pitcher-card' }, [
      el('div', { class: `pitcher-num hand-${pl.bats === 'L' ? 'L' : 'R'}`, text: pl.number ? `#${pl.number}` : (pl.name[0] || '?').toUpperCase() }),
      el('div', { class: 'pitcher-info' }, [
        el('h3', { text: pl.name }),
        el('div', { class: 'pitcher-meta', text: [
          BATS_LABEL[pl.bats] || 'Bats R',
          pl.position || null,
          pl.isPitcher ? 'Pitcher' : null
        ].filter(Boolean).join(' · ') })
      ])
    ]),
    el('div', { class: 'card-actions' }, [
      el('button', { class: 'btn btn-sm', onclick: onEdit }, 'Edit'),
      el('button', { class: 'btn btn-sm btn-danger', onclick: onDelete }, 'Delete')
    ])
  ]);
}

function deleteHitter(h) {
  if (!confirm(`Delete ${h.name}? Their at-bats will also be removed.`)) return;
  state.hitters = state.hitters.filter(x => x.id !== h.id);
  state.atbats = (state.atbats || []).filter(a => a.hitterId !== h.id);
  // Remove from any game's lineup.
  state.games.forEach(g => { if (g.myLineup) g.myLineup = g.myLineup.filter(id => id !== h.id); });
  state.ui.openHitterId = null;
  save();
  render();
}

function openHitterForm(existing) {
  openPlayerEditor({
    title: existing ? 'Edit Hitter' : 'Add Hitter',
    draft: existing ? JSON.parse(JSON.stringify(existing)) : { id: uid(), name: '', bats: 'R', number: '', position: '' },
    showPitcher: false,
    onSave: draft => {
      const idx = state.hitters.findIndex(h => h.id === draft.id);
      if (idx >= 0) state.hitters[idx] = draft; else state.hitters.push(draft);
    }
  });
}

/* ======================== OPPONENTS TAB =============================== */

function renderOpponents() {
  if (state.ui.openOpponentId) {
    const opp = opponentById(state.ui.openOpponentId);
    if (opp) return renderOpponentDetail(opp);
    state.ui.openOpponentId = null;
  }

  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'section-head' }, [
    el('h2', { text: 'Opponents' }),
    el('button', { class: 'btn btn-primary btn-sm', onclick: () => openOpponentForm() }, '+ Add Team')
  ]));

  if (state.opponents.length === 0) {
    wrap.appendChild(el('div', { class: 'empty' }, [
      el('p', { text: '⚔' }),
      el('p', { text: 'No opponents yet.' }),
      el('p', { class: 'muted', text: 'Add a team and build its roster so you can set their lineup at game time.' })
    ]));
    return wrap;
  }

  state.opponents.forEach(o => {
    wrap.appendChild(el('div', { class: 'game-row' }, [
      el('div', {}, [
        el('div', { class: 'gr-main', text: o.name }),
        el('div', { class: 'gr-sub', text: `${(o.players || []).length} player${(o.players || []).length === 1 ? '' : 's'}` })
      ]),
      el('button', { class: 'btn btn-sm', onclick: () => { state.ui.openOpponentId = o.id; save(); render(); } }, 'Open')
    ]));
  });
  return wrap;
}

function renderOpponentDetail(opp) {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'section-head' }, [
    el('button', { class: 'btn btn-sm', onclick: () => { state.ui.openOpponentId = null; save(); render(); } }, '‹ Back'),
    el('button', { class: 'btn btn-primary btn-sm', onclick: () => openPlayerForm(opp) }, '+ Add Player')
  ]));

  wrap.appendChild(el('div', { class: 'section-head' }, [
    el('h2', { text: opp.name }),
    el('div', {}, [
      el('button', { class: 'btn btn-sm', onclick: () => openOpponentForm(opp) }, 'Rename'),
      el('button', { class: 'btn btn-sm btn-danger', style: { marginLeft: '8px' }, onclick: () => deleteOpponent(opp) }, 'Delete')
    ])
  ]));

  const players = opp.players || [];
  if (!players.length) {
    wrap.appendChild(el('div', { class: 'empty' }, [el('p', { text: 'No players yet. Add their lineup and pitchers.' })]));
    return wrap;
  }
  players.forEach(pl => wrap.appendChild(playerCard(pl, () => openPlayerForm(opp, pl), () => deleteOpponentPlayer(opp, pl))));
  return wrap;
}

function openOpponentForm(existing) {
  const draft = existing ? { id: existing.id, name: existing.name } : { id: uid(), name: '' };
  const nameInput = el('input', { type: 'text', value: draft.name, placeholder: 'e.g. Bremen Blue Devils', autocomplete: 'off' });
  openModal(el('div', {}, [
    el('h3', { text: existing ? 'Rename Team' : 'Add Team' }),
    el('div', { class: 'field' }, [el('label', { text: 'Team name' }), nameInput]),
    el('div', { style: { display: 'flex', gap: '10px', marginTop: '8px' } }, [
      el('button', { class: 'btn btn-block', onclick: closeModal }, 'Cancel'),
      el('button', { class: 'btn btn-primary btn-block', onclick: () => {
        const name = nameInput.value.trim();
        if (!name) { toast('Enter a team name'); return; }
        if (existing) { existing.name = name; }
        else { const o = { id: draft.id, name, players: [] }; state.opponents.push(o); state.ui.openOpponentId = o.id; }
        save(); closeModal(); render();
      } }, 'Save')
    ])
  ]));
}

function deleteOpponent(opp) {
  if (!confirm(`Delete ${opp.name} and its roster?`)) return;
  state.opponents = state.opponents.filter(o => o.id !== opp.id);
  state.pitchers.forEach(p => { if (p.opponentId === opp.id) p.opponentId = null; });
  state.games.forEach(g => { if (g.opponentId === opp.id) { g.opponentId = null; g.oppLineup = []; } });
  state.ui.openOpponentId = null;
  save();
  render();
}

function openPlayerForm(opp, existing) {
  openPlayerEditor({
    title: existing ? 'Edit Player' : `Add Player — ${opp.name}`,
    draft: existing ? JSON.parse(JSON.stringify(existing)) : { id: uid(), name: '', bats: 'R', number: '', position: '', isPitcher: false },
    showPitcher: true,
    onSave: draft => {
      if (!opp.players) opp.players = [];
      const idx = opp.players.findIndex(p => p.id === draft.id);
      if (idx >= 0) opp.players[idx] = draft; else opp.players.push(draft);
    }
  });
}

function deleteOpponentPlayer(opp, pl) {
  if (!confirm(`Delete ${pl.name}?`)) return;
  opp.players = (opp.players || []).filter(p => p.id !== pl.id);
  state.games.forEach(g => { if (g.oppLineup) g.oppLineup = g.oppLineup.filter(id => id !== pl.id); });
  save();
  render();
}

// Shared player editor sheet for hitters and opponent players.
function openPlayerEditor({ title, draft, showPitcher, onSave }) {
  const nameInput = el('input', { type: 'text', value: draft.name, placeholder: 'Player name', autocomplete: 'off' });
  const numInput = el('input', { type: 'text', value: draft.number || '', placeholder: '#', inputmode: 'numeric', autocomplete: 'off' });

  const batsSeg = el('div', { class: 'segmented' }, BATS.map(b =>
    el('div', {
      class: 'chip' + (draft.bats === b ? ' selected' : ''),
      onclick: e => { draft.bats = b; batsSeg.querySelectorAll('.chip').forEach(c => c.classList.remove('selected')); e.currentTarget.classList.add('selected'); }
    }, BATS_LABEL[b])));

  const posSelect = el('select', { onchange: e => draft.position = e.target.value }, [
    el('option', { value: '' }, '— Position —'),
    ...POSITIONS.map(p => el('option', { value: p, selected: p === draft.position }, p))
  ]);

  const children = [
    el('h3', { text: title }),
    el('div', { class: 'field' }, [el('label', { text: 'Name' }), nameInput]),
    el('div', { class: 'row-2' }, [
      el('div', { class: 'field' }, [el('label', { text: 'Number' }), numInput]),
      el('div', { class: 'field' }, [el('label', { text: 'Position' }), posSelect])
    ]),
    el('div', { class: 'field' }, [el('label', { text: 'Bats' }), batsSeg])
  ];

  if (showPitcher) {
    const pitchChip = el('div', {
      class: 'chip' + (draft.isPitcher ? ' selected' : ''),
      onclick: e => { draft.isPitcher = !draft.isPitcher; e.currentTarget.classList.toggle('selected'); }
    }, 'Pitcher');
    children.push(el('div', { class: 'field' }, [el('label', { text: 'Role' }), el('div', { class: 'chip-group' }, [pitchChip])]));
  }

  children.push(el('div', { style: { display: 'flex', gap: '10px', marginTop: '8px' } }, [
    el('button', { class: 'btn btn-block', onclick: closeModal }, 'Cancel'),
    el('button', { class: 'btn btn-primary btn-block', onclick: () => {
      draft.name = nameInput.value.trim();
      if (!draft.name) { toast('Enter a name'); return; }
      draft.number = numInput.value.trim();
      onSave(draft);
      save(); closeModal(); render();
    } }, 'Save')
  ]));

  openModal(el('div', {}, children));
}

/* ============================ SCHEDULE TAB ============================ */

const todayISO = () => new Date().toISOString().slice(0, 10);

function scheduleOpponentName(e) {
  return (e.opponentId && opponentById(e.opponentId)?.name) || e.opponentName || 'TBD';
}

function renderSchedule() {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'section-head' }, [
    el('h2', { text: 'Schedule' }),
    el('div', {}, [
      el('button', { class: 'btn btn-sm', onclick: openScheduleImport }, 'Import'),
      el('button', { class: 'btn btn-primary btn-sm', style: { marginLeft: '8px' }, onclick: () => openScheduleForm() }, '+ Add')
    ])
  ]));

  if (!state.schedule.length) {
    wrap.appendChild(el('div', { class: 'empty' }, [
      el('p', { text: '📅' }),
      el('p', { text: 'No games scheduled.' }),
      el('p', { class: 'muted', text: 'Add games one at a time, or Import a whole schedule from a file or paste.' })
    ]));
    return wrap;
  }

  const today = todayISO();
  const sorted = [...state.schedule].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const upcoming = sorted.filter(e => (e.date || '') >= today);
  const past = sorted.filter(e => (e.date || '') < today).reverse();

  if (upcoming.length) {
    wrap.appendChild(el('div', { class: 'sched-group-label', text: 'Upcoming' }));
    upcoming.forEach(e => wrap.appendChild(scheduleCard(e)));
  }
  if (past.length) {
    wrap.appendChild(el('div', { class: 'sched-group-label', text: 'Past' }));
    past.forEach(e => wrap.appendChild(scheduleCard(e, true)));
  }
  return wrap;
}

function scheduleCard(e, isPast) {
  const linked = e.gameId && state.games.find(g => g.id === e.gameId);
  const ha = e.homeAway === 'away' ? '@' : 'vs';
  const dateStr = formatSchedDate(e.date) + (e.time ? ` · ${e.time}` : '');

  const actions = [];
  if (linked) {
    const sc = gameScore(linked);
    actions.push(el('span', { class: 'sched-result', text: `CHS ${sc.me}–${sc.opp}${linked.final ? ' (F)' : ''}` }));
    actions.push(el('button', { class: 'btn btn-sm', onclick: () => { state.activeGameId = linked.id; setTab('game'); } }, 'Open'));
  } else {
    actions.push(el('button', { class: 'btn btn-sm btn-primary', onclick: () => logFromSchedule(e) }, 'Log game'));
  }
  actions.push(el('button', { class: 'btn btn-sm', onclick: () => openScheduleForm(e) }, 'Edit'));

  return el('div', { class: 'card sched-card' + (isPast ? ' past' : '') }, [
    el('div', { class: 'sched-main' }, [
      el('div', { class: 'sched-date', text: dateStr }),
      el('div', { class: 'sched-opp', text: `${ha} ${scheduleOpponentName(e)}` }),
      e.location ? el('div', { class: 'sched-loc muted', text: e.location }) : null,
      e.notes ? el('div', { class: 'sched-loc muted', text: e.notes }) : null
    ]),
    el('div', { class: 'sched-actions' }, actions)
  ]);
}

function formatSchedDate(d) {
  if (!d) return 'TBD';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function logFromSchedule(e) {
  state.ui.prefill = { opponentId: e.opponentId || null, date: e.date, scheduleId: e.id };
  setTab('game');
}

function openScheduleForm(existing) {
  const draft = existing
    ? JSON.parse(JSON.stringify(existing))
    : { id: uid(), date: todayISO(), time: '', opponentId: null, opponentName: '', homeAway: 'home', location: '', notes: '' };

  const dateInput = el('input', { type: 'date', value: draft.date });
  const timeInput = el('input', { type: 'text', value: draft.time, placeholder: 'e.g. 5:30 PM', autocomplete: 'off' });
  const oppSelect = el('select', { onchange: e => { draft.opponentId = e.target.value || null; } }, [
    el('option', { value: '' }, '— Select team —'),
    ...state.opponents.map(o => el('option', { value: o.id, selected: o.id === draft.opponentId }, o.name))
  ]);
  const oppNameInput = el('input', { type: 'text', value: draft.opponentName || '', placeholder: 'or type a team name', autocomplete: 'off' });
  const locInput = el('input', { type: 'text', value: draft.location || '', placeholder: 'Field / location', autocomplete: 'off' });
  const notesInput = el('input', { type: 'text', value: draft.notes || '', placeholder: 'Notes (optional)', autocomplete: 'off' });

  const haSeg = el('div', { class: 'segmented' }, [['home', 'Home (vs)'], ['away', 'Away (@)']].map(([v, lbl]) =>
    el('div', {
      class: 'chip' + (draft.homeAway === v ? ' selected' : ''),
      onclick: ev => { draft.homeAway = v; haSeg.querySelectorAll('.chip').forEach(c => c.classList.remove('selected')); ev.currentTarget.classList.add('selected'); }
    }, lbl)));

  openModal(el('div', {}, [
    el('h3', { text: existing ? 'Edit Game' : 'Add Game' }),
    el('div', { class: 'row-2' }, [
      el('div', { class: 'field' }, [el('label', { text: 'Date' }), dateInput]),
      el('div', { class: 'field' }, [el('label', { text: 'Time' }), timeInput])
    ]),
    el('div', { class: 'field' }, [el('label', { text: 'Opponent' }), oppSelect]),
    state.opponents.length ? null : el('div', { class: 'field' }, [oppNameInput]),
    el('div', { class: 'field' }, [el('label', { text: 'Home / Away' }), haSeg]),
    el('div', { class: 'field' }, [el('label', { text: 'Location' }), locInput]),
    el('div', { class: 'field' }, [el('label', { text: 'Notes' }), notesInput]),
    el('div', { style: { display: 'flex', gap: '10px', marginTop: '8px' } }, [
      existing
        ? el('button', { class: 'btn btn-danger', onclick: () => { deleteScheduleEntry(existing); closeModal(); } }, 'Delete')
        : el('button', { class: 'btn btn-block', onclick: closeModal }, 'Cancel'),
      el('button', { class: 'btn btn-primary btn-block', onclick: () => {
        draft.date = dateInput.value;
        draft.time = timeInput.value.trim();
        draft.opponentName = state.opponents.length ? '' : oppNameInput.value.trim();
        draft.location = locInput.value.trim();
        draft.notes = notesInput.value.trim();
        const idx = state.schedule.findIndex(s => s.id === draft.id);
        if (idx >= 0) state.schedule[idx] = draft; else state.schedule.push(draft);
        save(); closeModal(); render();
      } }, 'Save')
    ])
  ]));
}

function deleteScheduleEntry(e) {
  if (!confirm('Remove this game from the schedule?')) return;
  state.schedule = state.schedule.filter(s => s.id !== e.id);
  save();
  render();
}

// Import: paste rows or pick a .csv/.txt file. One game per line:
// date, opponent, home/away, time, location
function openScheduleImport() {
  const ta = el('textarea', { class: 'import-ta', placeholder:
    '2026-03-14, Bremen, home, 5:30 PM, Carrollton HS\n2026-03-17, Villa Rica, away, 6:00 PM' });
  const fileInput = el('input', { type: 'file', accept: '.csv,.txt,text/csv,text/plain', onchange: ev => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { ta.value = String(reader.result || ''); };
    reader.readAsText(f);
  } });

  openModal(el('div', {}, [
    el('h3', { text: 'Import Schedule' }),
    el('p', { class: 'sheet-sub', text: 'One game per line: date, opponent, home/away, time, location. Commas or tabs.' }),
    el('div', { class: 'field' }, [el('label', { text: 'Upload a .csv / .txt file' }), fileInput]),
    el('div', { class: 'field' }, [el('label', { text: 'Or paste rows' }), ta]),
    el('div', { style: { display: 'flex', gap: '10px', marginTop: '8px' } }, [
      el('button', { class: 'btn btn-block', onclick: closeModal }, 'Cancel'),
      el('button', { class: 'btn btn-primary btn-block', onclick: () => {
        const rows = parseScheduleText(ta.value);
        if (!rows.length) { toast('Nothing to import'); return; }
        rows.forEach(r => state.schedule.push(r));
        save(); closeModal(); render();
        toast(`Imported ${rows.length} game${rows.length === 1 ? '' : 's'}`);
      } }, 'Import')
    ])
  ]));
}

function parseScheduleText(text) {
  const out = [];
  (text || '').split(/\r?\n/).forEach(line => {
    const raw = line.trim();
    if (!raw) return;
    const cols = raw.split(/\t|,/).map(c => c.trim());
    const date = normalizeDate(cols[0] || '');
    if (!date) return; // need at least a parseable date
    const oppName = cols[1] || '';
    const matched = state.opponents.find(o => o.name.toLowerCase() === oppName.toLowerCase());
    const haRaw = (cols[2] || '').toLowerCase();
    const homeAway = (haRaw.includes('away') || haRaw === '@' || haRaw === 'a') ? 'away' : 'home';
    out.push({
      id: uid(),
      date,
      time: cols[3] || '',
      opponentId: matched ? matched.id : null,
      opponentName: matched ? '' : oppName,
      homeAway,
      location: cols[4] || '',
      notes: ''
    });
  });
  return out;
}

function normalizeDate(s) {
  s = (s || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/);
  if (m) {
    let [, mo, d, y] = m;
    if (!y) y = String(new Date().getFullYear());
    else if (y.length === 2) y = '20' + y;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return '';
}

/* ============================ GAME TAB ================================ */

function newAtBat() {
  return { balls: 0, strikes: 0 };
}

function createGame(pitcherId, opponentId, date) {
  const g = {
    id: uid(),
    pitcherId,
    opponentId: opponentId || null,
    opponent: opponentId ? (opponentById(opponentId)?.name || '') : '',
    date: date || new Date().toISOString().slice(0, 10),
    pitches: [],
    inning: 1,
    half: 'top',
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: [false, false, false], // 1B, 2B, 3B
    batterNo: 1,
    batterHand: 'R',      // fallback when no lineup is set / switch hitters
    battingSide: 'opp',   // opponent hits against our pitcher by default
    myLineup: [],         // ordered hitter ids
    oppLineup: [],        // ordered opponent player ids
    myIdx: 0,             // current spot in my order
    oppIdx: 0,            // current spot in opponent order
    score: { me: 0, opp: 0 }, // running score: Carrollton vs opponent
    final: false          // marked when the game is over
  };
  state.games.push(g);
  state.activeGameId = g.id;
  save();
  return g;
}

function gameOpponentName(g) {
  return (g.opponentId && opponentById(g.opponentId)?.name) || g.opponent || 'Opponent';
}

function renderGame() {
  const wrap = el('div');
  const g = activeGame();

  if (state.pitchers.length === 0) {
    wrap.appendChild(el('div', { class: 'empty' }, [
      el('p', { text: 'Add a pitcher to scout first.' }),
      el('button', { class: 'btn btn-primary', onclick: () => setTab('pitchers') }, 'Go to Pitchers')
    ]));
    return wrap;
  }

  if (!g) {
    wrap.appendChild(el('div', { class: 'section-head' }, [el('h2', { text: 'Log Game' })]));
    wrap.appendChild(renderGamePicker());
    return wrap;
  }

  const p = pitcherById(g.pitcherId);

  // Header row with pitcher + change game
  wrap.appendChild(el('div', { class: 'section-head' }, [
    el('div', {}, [
      el('h2', { text: p ? p.name : 'Pitcher' }),
      el('div', { class: 'muted', text: `vs ${gameOpponentName(g)} · ${g.date}${g.final ? ' · Final' : ''}` })
    ]),
    el('button', { class: 'btn btn-sm', onclick: () => { state.activeGameId = null; save(); render(); } }, 'Games')
  ]));

  wrap.appendChild(scoreboard(g));
  if (g.pitches.length) wrap.appendChild(endGameBar(g, p));
  wrap.appendChild(lineupPanel(g));
  wrap.appendChild(strikeZonePanel(g));
  wrap.appendChild(pitchLog(g));
  return wrap;
}

// Collapsible lineup setup for both teams, plus a current-batter readout.
function lineupPanel(g) {
  if (!state.ui.lineupOpen) state.ui.lineupOpen = {};
  const open = !!state.ui.lineupOpen[g.id];
  const myCount = (g.myLineup || []).length;
  const oppCount = (g.oppLineup || []).length;

  const header = el('div', { class: 'lineup-head', onclick: () => {
    state.ui.lineupOpen[g.id] = !open; save(); render();
  } }, [
    el('span', { text: `Lineups` }),
    el('span', { class: 'muted', text: `${open ? '▲' : '▼'}  Us ${myCount} · ${gameOpponentName(g)} ${oppCount}` })
  ]);

  const body = el('div', { class: 'lineup-body' });
  if (open) {
    body.appendChild(lineupBuilder(g, 'me'));
    body.appendChild(lineupBuilder(g, 'opp'));
  }
  return el('div', { class: 'card lineup-card' }, [header, body]);
}

function lineupBuilder(g, side) {
  const isMe = side === 'me';
  const title = isMe ? 'Carrollton (Us)' : gameOpponentName(g);
  const pool = isMe ? state.hitters
    : (g.opponentId ? (opponentById(g.opponentId)?.players || []) : []);
  const lineup = lineupFor(g, side);

  const wrap = el('div', { class: 'lineup-section' });
  wrap.appendChild(el('div', { class: 'lineup-title', text: title }));

  if (!pool.length) {
    wrap.appendChild(el('div', { class: 'muted', style: { fontSize: '13px' }, text:
      isMe ? 'Add hitters on the My Team tab first.'
           : (g.opponentId ? 'This opponent has no players yet.' : 'No opponent selected for this game.') }));
    return wrap;
  }

  // Ordered, selected lineup with batting-order numbers; tap to remove.
  const orderEl = el('div', { class: 'lineup-order' });
  lineup.forEach((id, i) => {
    const pl = lineupPlayer(g, side, id);
    if (!pl) return;
    orderEl.appendChild(el('div', { class: 'lineup-slot', onclick: () => {
      const arr = lineupFor(g, side).slice();
      arr.splice(i, 1);
      if (isMe) g.myLineup = arr; else g.oppLineup = arr;
      clampIdx(g, side);
      save(); render();
    } }, [
      el('span', { class: 'slot-no', text: String(i + 1) }),
      el('span', { class: 'slot-name', text: `${pl.number ? '#' + pl.number + ' ' : ''}${pl.name}` }),
      el('span', { class: 'slot-bats', text: pl.bats || 'R' }),
      el('span', { class: 'slot-x', text: '×' })
    ]));
  });
  if (lineup.length) wrap.appendChild(orderEl);

  // Available players to add (not already in the order).
  const avail = pool.filter(pl => !lineup.includes(pl.id));
  if (avail.length) {
    wrap.appendChild(el('div', { class: 'lineup-pool' }, avail.map(pl =>
      el('div', { class: 'pool-chip', onclick: () => {
        const arr = lineupFor(g, side).slice();
        arr.push(pl.id);
        if (isMe) g.myLineup = arr; else g.oppLineup = arr;
        save(); render();
      } }, `+ ${pl.number ? '#' + pl.number + ' ' : ''}${pl.name}`))));
  }
  return wrap;
}

function clampIdx(g, side) {
  const len = lineupFor(g, side).length || 1;
  if (side === 'me') g.myIdx = (g.myIdx || 0) % len;
  else g.oppIdx = (g.oppIdx || 0) % len;
}

// Live pitching line + finalize control under the scoreboard.
function endGameBar(g, p) {
  const line = pitchingLine(g.pitches);
  const sc = gameScore(g);
  return el('div', { class: 'card endgame-bar' }, [
    el('div', { class: 'eg-line' }, [
      el('span', { text: `${line.ip} IP · ${line.k} K · ${line.bb} BB · ${line.h} H · ${sc.opp} R` }),
      el('span', { class: 'muted', text: `CHS ${sc.me}–${sc.opp} ${gameOpponentName(g)} · ${line.pitches} P` })
    ]),
    g.final
      ? el('button', { class: 'btn btn-sm', onclick: () => { g.final = false; save(); render(); toast('Game reopened'); } }, 'Reopen')
      : el('button', { class: 'btn btn-sm btn-primary', onclick: () => {
          if (!confirm(`End this game for ${p ? p.name : 'this pitcher'}? Their results will be saved to their card.`)) return;
          g.final = true; save();
          state.ui.openPitcherId = g.pitcherId; state.activeGameId = null;
          setTab('pitchers');
          toast('Game saved to card');
        } }, 'End Game')
  ]);
}

function renderGamePicker() {
  const box = el('div');

  // start new game form
  const oppSelect = el('select', { onchange: () => syncOpp() }, [
    el('option', { value: '' }, '— Select opponent —'),
    ...state.opponents.map(o => el('option', { value: o.id }, o.name))
  ]);
  const pitcherSelect = el('select', {},
    state.pitchers.map(p => el('option', { value: p.id }, `${p.name} (${p.hand})`)));
  const dateInput = el('input', { type: 'date', value: new Date().toISOString().slice(0, 10) });

  // Pre-fill from a "Log game" tap on the Schedule tab.
  const prefill = state.ui.prefill;
  if (prefill) {
    if (prefill.opponentId) oppSelect.value = prefill.opponentId;
    if (prefill.date) dateInput.value = prefill.date;
  }

  // Picking a pitcher with a team association auto-selects that opponent.
  pitcherSelect.addEventListener('change', () => {
    const p = pitcherById(pitcherSelect.value);
    if (p && p.opponentId) oppSelect.value = p.opponentId;
  });
  function syncOpp() { /* opponent chosen manually; nothing else to do */ }

  box.appendChild(el('div', { class: 'card' }, [
    el('h3', { text: 'Start New Game', style: { margin: '0 0 12px' } }),
    el('div', { class: 'field' }, [el('label', { text: 'Scouting Pitcher' }), pitcherSelect]),
    el('div', { class: 'field' }, [el('label', { text: 'Opponent' }), oppSelect]),
    !state.opponents.length
      ? el('div', { class: 'muted', style: { marginTop: '-6px', marginBottom: '10px', fontSize: '13px' } },
          'Tip: add a team on the Opponents tab to set their lineup.')
      : null,
    el('div', { class: 'field' }, [el('label', { text: 'Date' }), dateInput]),
    el('button', { class: 'btn btn-primary btn-block', onclick: () => {
      if (!pitcherSelect.value) { toast('Pick a pitcher'); return; }
      const g = createGame(pitcherSelect.value, oppSelect.value || null, dateInput.value);
      // Link back to the schedule entry this was launched from, if any.
      if (prefill && prefill.scheduleId) {
        const se = state.schedule.find(s => s.id === prefill.scheduleId);
        if (se) se.gameId = g.id;
      }
      state.ui.prefill = null;
      save();
      render();
    } }, 'Start Game')
  ]));

  if (state.games.length) {
    box.appendChild(el('div', { class: 'log-head' }, [el('div', { class: 'muted', text: 'Continue a game' })]));
    [...state.games].reverse().forEach(g => {
      const p = pitcherById(g.pitcherId);
      box.appendChild(el('div', { class: 'game-row' }, [
        el('div', {}, [
          el('div', { class: 'gr-main' }, [
            p ? p.name : 'Unknown',
            g.final ? el('span', { class: 'badge badge-final', style: { marginLeft: '8px' }, text: 'Final' }) : null
          ]),
          el('div', { class: 'gr-sub', text: `vs ${gameOpponentName(g)} · ${g.date} · ${g.pitches.length} pitches` })
        ]),
        el('button', { class: 'btn btn-sm', onclick: () => { state.activeGameId = g.id; save(); render(); } }, 'Open')
      ]));
    });
  }
  return box;
}

function dots(n, total, fillClass) {
  const row = el('div', { class: 'dots' });
  for (let i = 0; i < total; i++)
    row.appendChild(el('div', { class: 'dot' + (i < n ? ` ${fillClass}` : '') }));
  return row;
}

// Runs auto-tallied from logged at-bats (by batting side).
function autoRuns(g) {
  const r = { me: 0, opp: 0 };
  (g.pitches || []).forEach(pt => { if (pt.runs) r[pt.battingSide === 'me' ? 'me' : 'opp'] += pt.runs; });
  return r;
}

// Displayed score = runs auto-scored on logged at-bats + manual adjustments.
function gameScore(g) {
  const s = g.score || { me: 0, opp: 0 };
  const a = autoRuns(g);
  return { me: a.me + (s.me || 0), opp: a.opp + (s.opp || 0) };
}

function adjustScore(g, side, delta) {
  if (!g.score) g.score = { me: 0, opp: 0 };
  // Don't let the manual offset push the displayed total below 0.
  if (delta < 0 && gameScore(g)[side] <= 0) return;
  g.score[side] = (g.score[side] || 0) + delta;
  save();
  render();
}

/* ---- automatic baserunner advancement ---- */

// Mutates g.bases ([1B,2B,3B] booleans) for an at-bat outcome and returns the
// number of runs that scored. `kind`: walk | hit1 | hit2 | hit3 | hr | out | kout.
// runsChosen (optional) sets how many crossed for hits/outs; otherwise the
// forced minimum is used.
function advanceRunners(g, kind, runsChosen) {
  const b = (g.bases || [false, false, false]).map(Boolean); // [1B,2B,3B]
  const occ = []; // occupied bases, closest-to-home first
  if (b[2]) occ.push(3);
  if (b[1]) occ.push(2);
  if (b[0]) occ.push(1);

  if (kind === 'kout') return 0;            // strikeout: no movement
  if (kind === 'hr') { g.bases = [false, false, false]; return occ.length + 1; }
  if (kind === 'walk') {                    // walk / HBP: force only
    let [b1, b2, b3] = b;
    let scored = 0;
    if (b1 && b2 && b3) scored = 1;         // bases loaded, forced run
    else if (b1 && b2) b3 = true;
    else if (b1) b2 = true;
    b1 = true;
    g.bases = [b1, b2, b3];
    return scored;
  }

  const shift = kind === 'hit1' ? 1 : kind === 'hit2' ? 2 : kind === 'hit3' ? 3 : 0; // out=0
  const forced = occ.filter(p => p + shift >= 4).length;
  const runs = runsChosen == null ? forced : Math.max(forced, Math.min(runsChosen, occ.length));
  const remaining = occ.slice(runs); // lead `runs` runners score; rest stay
  const nb = [false, false, false];
  remaining.map(p => Math.min(p + shift, 3)).sort((a, c) => c - a).forEach(t => {
    let pos = t; while (pos >= 1 && nb[pos - 1]) pos--; if (pos >= 1) nb[pos - 1] = true;
  });
  if (kind === 'hit1' || kind === 'hit2' || kind === 'hit3') {
    let pos = shift; while (pos >= 1 && nb[pos - 1]) pos--; if (pos >= 1) nb[pos - 1] = true;
  }
  g.bases = nb;
  return runs;
}

// What an at-bat-ending result implies for the runs prompt. Only prompts when
// a runner is in scoring position (2B/3B) and the count is genuinely variable;
// otherwise applies a sensible default automatically.
function atBatRunsInfo(g, resultId) {
  const bases = g.bases || [false, false, false];
  const occ = []; if (bases[2]) occ.push(3); if (bases[1]) occ.push(2); if (bases[0]) occ.push(1);
  const onBase = occ.length;
  const hasScoringPos = !!(bases[1] || bases[2]);
  const none = { needsPrompt: false, autoRuns: null, min: 0, max: 0, smart: 0, onBase };

  if (resultId === 'ball' || resultId === 'called_strike' || resultId === 'swing_strike'
      || resultId === 'foul' || resultId === 'hr' || resultId === 'hbp') return none;

  const shiftMap = { single: 1, hit: 1, double: 2, triple: 3, in_play_out: 0 };
  if (!(resultId in shiftMap)) return none;
  const shift = shiftMap[resultId];
  const forced = occ.filter(p => p + shift >= 4).length;
  const max = occ.length;
  // Smart default: doubles/triples plate everyone; singles plate runners from
  // 2B/3B; outs plate nobody (the user can flag a sac fly via the prompt).
  let smart = (resultId === 'double' || resultId === 'triple') ? max
    : resultId === 'in_play_out' ? 0
    : occ.filter(p => p >= 2).length;
  smart = Math.max(forced, Math.min(smart, max));
  const needsPrompt = hasScoringPos && max > forced;
  return { needsPrompt, autoRuns: smart, min: forced, max, smart, onBase };
}

function scoreStrip(g) {
  const sc = gameScore(g);
  const teamCell = (side, name) => el('div', { class: 'score-team' }, [
    el('div', { class: 'st-name', text: name }),
    el('div', { class: 'score-ctrl' }, [
      el('button', { class: 'score-btn', onclick: () => adjustScore(g, side, -1) }, '−'),
      el('span', { class: 'score-num', text: String(sc[side]) }),
      el('button', { class: 'score-btn', onclick: () => adjustScore(g, side, 1) }, '+')
    ])
  ]);
  return el('div', {}, [
    el('div', { class: 'sb-score' }, [
      teamCell('me', 'CHS'),
      el('div', { class: 'score-vs', text: '–' }),
      teamCell('opp', (gameOpponentName(g) || 'OPP').slice(0, 10).toUpperCase())
    ]),
    el('div', { class: 'score-hint', text: 'Runs auto-tally from at-bats · ± to adjust' })
  ]);
}

function scoreboard(g) {
  // bases
  const basesEl = el('div', { class: 'bases' });
  [['base-1', 0], ['base-2', 1], ['base-3', 2]].forEach(([cls, idx]) => {
    basesEl.appendChild(el('div', {
      class: `base ${cls}` + (g.bases[idx] ? ' on' : ''),
      onclick: () => { g.bases[idx] = !g.bases[idx]; save(); render(); }
    }));
  });

  return el('div', { class: 'scoreboard' }, [
    scoreStrip(g),
    el('div', { class: 'sb-top' }, [
      el('div', { class: 'sb-stat' }, [el('span', { class: 'sb-label', text: 'BALLS' }), dots(g.balls, 4, 'fill-green')]),
      el('div', { class: 'sb-stat' }, [el('span', { class: 'sb-label', text: 'STRIKES' }), dots(g.strikes, 3, 'fill-yellow')]),
      el('div', { class: 'sb-stat' }, [el('span', { class: 'sb-label', text: 'OUTS' }), dots(g.outs, 3, 'fill-red')])
    ]),
    el('div', { class: 'sb-bottom' }, [
      el('div', { class: 'sb-inning' }, [
        `${g.half === 'top' ? '▲' : '▼'} Inn ${g.inning}  `,
        el('small', { text: `· PA #${g.batterNo}` })
      ]),
      basesEl
    ]),
    batterControls(g)
  ]);
}

// Batting-side toggle + current-batter readout + manual-hand fallback.
function batterControls(g) {
  const cb = currentBatter(g);
  const hasLineups = (g.myLineup || []).length || (g.oppLineup || []).length;
  const rows = [];

  if (hasLineups) {
    rows.push(el('div', { class: 'sb-hand' }, [
      el('span', { class: 'sb-label', text: 'BATTING' }),
      el('div', { class: 'segmented hand-seg' }, [['me', 'Us'], ['opp', gameOpponentName(g)]].map(([s, lbl]) =>
        el('div', {
          class: 'chip' + ((g.battingSide || 'me') === s ? ' selected' : ''),
          onclick: () => { g.battingSide = s; save(); render(); }
        }, lbl)))
    ]));
  }

  if (cb) {
    const pl = cb.player;
    const handTxt = pl.bats === 'S' ? `S → ${g.batterHand || 'R'}` : (pl.bats || 'R');
    rows.push(el('div', { class: 'batter-now' }, [
      el('span', { class: 'bn-slot', text: String(cb.slot) }),
      el('div', { class: 'bn-info' }, [
        el('div', { class: 'bn-name', text: `${pl.number ? '#' + pl.number + ' ' : ''}${pl.name}` }),
        el('div', { class: 'bn-sub', text: `Now batting · bats ${handTxt}` })
      ]),
      el('button', { class: 'btn btn-sm', onclick: () => advanceBatter(g, 1) }, 'Next ›')
    ]));
  }

  if (!cb || cb.player.bats === 'S') {
    rows.push(el('div', { class: 'sb-hand' }, [
      el('span', { class: 'sb-label', text: 'BATTER BATS' }),
      el('div', { class: 'segmented hand-seg' }, ['R', 'L'].map(h =>
        el('div', {
          class: 'chip' + ((g.batterHand || 'R') === h ? ' selected' : ''),
          onclick: () => { g.batterHand = h; save(); render(); }
        }, h === 'R' ? 'Right' : 'Left')))
    ]));
  }

  return el('div', { class: 'sb-batter' }, rows);
}

// Manually nudge the batting order (subs, scorekeeping fixes).
function advanceBatter(g, dir) {
  const side = g.battingSide || 'me';
  const len = lineupFor(g, side).length;
  if (!len) return;
  if (side === 'me') g.myIdx = (((g.myIdx || 0) + dir) % len + len) % len;
  else g.oppIdx = (((g.oppIdx || 0) + dir) % len + len) % len;
  save(); render();
}

// The effective handedness of the current batter (resolves switch hitters).
function effectiveBatterHand(g) {
  const cb = currentBatter(g);
  if (cb && cb.player.bats && cb.player.bats !== 'S') return cb.player.bats;
  return g.batterHand || 'R';
}

function strikeZonePanel(g) {
  const grid = el('div', { class: 'zone-grid' });
  ZONES.forEach(z => {
    const cell = el('div', {
      class: `zcell ${z.kind}`,
      style: { gridColumn: z.col, gridRow: z.row },
      onclick: () => openPitchEntry(g, z.id, z.kind)
    });
    if (z.kind === 'strike') cell.appendChild(el('span', { class: 'zval', text: z.id }));
    grid.appendChild(cell);
  });

  return el('div', { class: 'zone-wrap' }, [
    el('div', { class: 'zone-caption', html: 'Tap where the pitch crossed the plate. <strong>Inner squares</strong> = strike zone.' }),
    grid,
    el('div', { class: 'zone-legend' }, [
      el('span', { html: '<span class="legend-swatch" style="background:#1e242c;border:1px solid #38424f"></span>Strike zone' }),
      el('span', { html: '<span class="legend-swatch" style="background:#11151b;border:1px dashed #2a323d"></span>Out of zone' })
    ])
  ]);
}

/* ---- pitch entry sheet: choose pitch type then result ---- */

function openPitchEntry(g, zoneId, zoneKind) {
  const p = pitcherById(g.pitcherId);
  const pitchOptions = (p && p.pitches && p.pitches.length) ? p.pitches : ['Pitch'];
  const draft = { zoneId, pitchType: pitchOptions[0] };

  function renderSheet() {
    const ptGrid = el('div', { class: 'opt-grid cols-3' }, pitchOptions.map(pt =>
      el('div', {
        class: 'opt' + (draft.pitchType === pt ? ' tone-strike' : ''),
        style: draft.pitchType === pt ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {},
        onclick: () => { draft.pitchType = pt; openModal(buildBody()); }
      }, pt)));

    const mkRes = group => el('div', { class: 'opt-grid' }, RESULTS.filter(r => r.group === group).map(r =>
      el('div', {
        class: `opt tone-${r.tone}`,
        onclick: () => commitPitch(g, draft.zoneId, draft.pitchType, r.id)
      }, r.label)));

    return el('div', {}, [
      el('div', { class: 'sheet-handle' }),
      el('h3', { text: `Zone ${zoneId} · ${zoneKind === 'strike' ? 'In zone' : 'Out of zone'}` }),
      el('p', { class: 'sheet-sub', text: p ? p.name : '' }),
      el('div', { class: 'sheet-section-label', text: 'Pitch Type' }),
      ptGrid,
      el('div', { class: 'sheet-section-label', text: 'Result' }),
      mkRes('nc'),
      el('div', { class: 'sheet-section-label', text: 'If put in play' }),
      mkRes('ip'),
      el('button', { class: 'btn btn-block', style: { marginTop: '16px' }, onclick: closeModal }, 'Cancel')
    ]);
  }
  const buildBody = renderSheet;
  openModal(renderSheet());
}

function commitPitch(g, zoneId, pitchType, resultId) {
  const info = atBatRunsInfo(g, resultId);
  if (info.needsPrompt) {
    openRunsPicker(g, resultId, info, runs => finalizePitch(g, zoneId, pitchType, resultId, runs));
  } else {
    finalizePitch(g, zoneId, pitchType, resultId, info.autoRuns);
  }
}

// Quick "how many scored?" prompt for ambiguous at-bats (e.g. single with a
// runner on second). Pre-selects the forced minimum.
function openRunsPicker(g, resultId, info, onPick) {
  const chips = [];
  for (let r = info.min; r <= info.max; r++) chips.push(r);
  openModal(el('div', {}, [
    el('div', { class: 'sheet-handle' }),
    el('h3', { text: `${RESULT_LABEL[resultId]} — runs scored?` }),
    el('p', { class: 'sheet-sub', text: `${info.onBase} runner${info.onBase === 1 ? '' : 's'} on base. How many crossed the plate?` }),
    el('div', { class: 'opt-grid cols-3' }, chips.map(r =>
      el('div', { class: 'opt' + (r === info.smart ? ' tone-strike' : ''), onclick: () => onPick(r) },
        r === 0 ? 'None' : `${r} run${r > 1 ? 's' : ''}`))),
    el('button', { class: 'btn btn-block', style: { marginTop: '14px' }, onclick: closeModal }, 'Cancel')
  ]));
}

function finalizePitch(g, zoneId, pitchType, resultId, runsChosen) {
  const cb = currentBatter(g);
  const pitch = {
    id: uid(),
    zone: zoneId,
    pitchType,
    result: resultId,
    inning: g.inning,
    half: g.half,
    balls: g.balls,
    strikes: g.strikes,
    outs: g.outs,
    batterNo: g.batterNo,
    batterHand: effectiveBatterHand(g),
    battingSide: g.battingSide || 'me',
    batterId: cb ? cb.player.id : null,
    batterName: cb ? cb.player.name : null,
    runsChosen: (runsChosen == null ? null : runsChosen),
    ts: Date.now()
  };
  g.pitches.push(pitch);
  pitch.runs = applyCount(g, resultId, pitch.battingSide, runsChosen);
  save();
  closeModal();
  render();
  const runTxt = pitch.runs ? ` · ${pitch.runs} run${pitch.runs > 1 ? 's' : ''}` : '';
  toast(`${pitchType} · ${RESULT_LABEL[resultId]}${cb ? ' · ' + cb.player.name : ''}${runTxt}`);
}

// Advance count/outs/innings AND baserunners for the result. Returns the
// number of runs that scored on the play. `side` is the batting lineup;
// `runsChosen` (optional) sets runs for ambiguous hits/outs.
function applyCount(g, resultId, side, runsChosen) {
  side = side || g.battingSide || 'me';
  let runs = 0;
  const advanceOrder = () => {
    const len = lineupFor(g, side).length;
    if (!len) return;
    if (side === 'me') g.myIdx = ((g.myIdx || 0) + 1) % len;
    else g.oppIdx = ((g.oppIdx || 0) + 1) % len;
  };
  const endAtBat = () => { g.balls = 0; g.strikes = 0; g.batterNo += 1; advanceOrder(); };
  const recordOut = () => {
    g.outs += 1;
    if (g.outs >= 3) {
      g.outs = 0;
      g.bases = [false, false, false];
      if (g.half === 'top') g.half = 'bottom';
      else { g.half = 'top'; g.inning += 1; }
    }
  };

  switch (resultId) {
    case 'ball':
      g.balls += 1;
      if (g.balls >= 4) { runs = advanceRunners(g, 'walk'); endAtBat(); } // walk
      break;
    case 'called_strike':
    case 'swing_strike':
      g.strikes += 1;
      if (g.strikes >= 3) { recordOut(); endAtBat(); } // strikeout (no advance)
      break;
    case 'foul':
      if (g.strikes < 2) g.strikes += 1;
      break;
    case 'in_play_out':
      runs = advanceRunners(g, 'out', runsChosen);
      recordOut(); endAtBat();
      break;
    case 'single': case 'hit': runs = advanceRunners(g, 'hit1', runsChosen); endAtBat(); break;
    case 'double': runs = advanceRunners(g, 'hit2', runsChosen); endAtBat(); break;
    case 'triple': runs = advanceRunners(g, 'hit3', runsChosen); endAtBat(); break;
    case 'hr':     runs = advanceRunners(g, 'hr'); endAtBat(); break;
    case 'hbp':    runs = advanceRunners(g, 'walk'); endAtBat(); break;
  }
  return runs;
}

function pitchLog(g) {
  const box = el('div');
  box.appendChild(el('div', { class: 'log-head' }, [
    el('div', { class: 'muted', text: `${g.pitches.length} pitch${g.pitches.length === 1 ? '' : 'es'} logged` }),
    g.pitches.length
      ? el('button', { class: 'btn btn-sm', onclick: () => undoLast(g) }, '↶ Undo last')
      : null
  ]));

  if (!g.pitches.length) return box;

  const list = el('div', { class: 'log-list' });
  [...g.pitches].reverse().forEach(pt => {
    list.appendChild(el('div', { class: 'log-row' }, [
      el('div', { class: `log-pill ${RESULT_TONE[pt.result]}`, text: pt.zone }),
      el('div', { class: 'log-main' }, [
        el('div', { text: `${pt.pitchType} — ${RESULT_LABEL[pt.result]}` }),
        el('div', { class: 'log-sub', text: `Inn ${pt.inning} · ${pt.balls}-${pt.strikes} · ${pt.batterName || 'Batter #' + pt.batterNo}` })
      ])
    ]));
  });
  box.appendChild(list);
  return box;
}

function undoLast(g) {
  if (!g.pitches.length) return;
  g.pitches.pop();
  // Recompute game state from scratch for correctness.
  recomputeGame(g);
  save();
  render();
}

function recomputeGame(g) {
  g.inning = 1; g.half = 'top'; g.outs = 0; g.balls = 0; g.strikes = 0;
  g.batterNo = 1; g.bases = [false, false, false]; g.myIdx = 0; g.oppIdx = 0;
  const pitches = g.pitches;
  g.pitches = [];
  pitches.forEach(pt => {
    pt.inning = g.inning; pt.half = g.half; pt.balls = g.balls;
    pt.strikes = g.strikes; pt.outs = g.outs; pt.batterNo = g.batterNo;
    g.pitches.push(pt);
    // Re-derive runs/baserunners from the stored runsChosen so undo stays exact.
    pt.runs = applyCount(g, pt.result, pt.battingSide || 'me', pt.runsChosen);
  });
}

/* ===================== PITCHING LINE / RESULTS ======================== */

// Classify a pitch as the end of an at-bat (using the count BEFORE the pitch).
// Returns 'K' | 'BB' | 'H' | 'OUT' | 'HBP' | null.
function atBatEnd(pt) {
  const b = pt.balls || 0, s = pt.strikes || 0;
  if (pt.result === 'ball') return b >= 3 ? 'BB' : null;
  if (pt.result === 'called_strike' || pt.result === 'swing_strike') return s >= 2 ? 'K' : null;
  if (pt.result === 'in_play_out') return 'OUT';
  if (pt.result === 'hbp') return 'HBP';
  if (HIT_RESULTS.includes(pt.result)) return 'H';
  return null;
}

function formatIP(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

// Aggregate a pitching line from a set of pitches (one game or many).
function pitchingLine(pitches) {
  let k = 0, bb = 0, h = 0, hbp = 0, ipOuts = 0, bf = 0;
  pitches.forEach(pt => {
    const end = atBatEnd(pt);
    if (!end) return;
    bf++;
    if (end === 'K') k++;
    else if (end === 'BB') bb++;
    else if (end === 'H') h++;
    else if (end === 'OUT') ipOuts++;
    else if (end === 'HBP') hbp++;
  });
  const outs = k + ipOuts;
  const strikes = pitches.filter(pt =>
    ['called_strike', 'swing_strike', 'foul'].includes(pt.result) || IN_PLAY_RESULTS.includes(pt.result)).length;
  const whiffs = pitches.filter(pt => pt.result === 'swing_strike').length;
  const swings = pitches.filter(pt => SWING_RESULTS.includes(pt.result)).length;
  const bip = pitches.filter(pt => IN_PLAY_RESULTS.includes(pt.result)).length;
  const total = pitches.length;
  return {
    pitches: total, bf, k, bb, h, hbp, outs,
    ip: formatIP(outs),
    strikePct: total ? Math.round((strikes / total) * 100) : 0,
    whiffPct: swings ? Math.round((whiffs / swings) * 100) : 0,
    baa: bip ? (h / bip).toFixed(3).replace(/^0/, '') : '—'
  };
}

function pitcherGames(pitcherId) {
  return state.games.filter(g => g.pitcherId === pitcherId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/* ===================== PITCHER PROFILE (PLAYER CARD) ================== */

function openPitcherProfile(p) {
  state.ui.openPitcherId = p.id;
  save();
  render();
}

function renderPitcherProfile(p) {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'section-head' }, [
    el('button', { class: 'btn btn-sm', onclick: () => { state.ui.openPitcherId = null; save(); render(); } }, '‹ Back'),
    el('div', {}, [
      el('button', { class: 'btn btn-sm', onclick: () => openPitcherForm(p) }, 'Edit'),
      el('button', { class: 'btn btn-sm btn-danger', style: { marginLeft: '8px' }, onclick: () => deletePitcher(p) }, 'Delete')
    ])
  ]));

  // Identity header
  const initials = p.name.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
  wrap.appendChild(el('div', { class: 'profile-head' }, [
    el('div', { class: `profile-badge hand-${p.hand}`, text: initials || '?' }),
    el('div', {}, [
      el('h2', { style: { margin: 0 }, text: p.name }),
      el('div', { class: 'muted', text: [
        p.classification ? fmtClass(p.classification) : null,
        p.hand === 'L' ? 'Left-handed' : 'Right-handed',
        p.opponentId && opponentById(p.opponentId) ? opponentById(p.opponentId).name : null
      ].filter(Boolean).join(' · ') }),
      p.pitches && p.pitches.length
        ? el('div', { class: 'pitch-tags', style: { marginTop: '6px' } }, p.pitches.map(pt => el('span', { class: 'pitch-tag', text: pt })))
        : null
    ])
  ]));

  const games = pitcherGames(p.id);
  if (!games.length) {
    wrap.appendChild(el('div', { class: 'empty' }, [
      el('p', { text: 'No games logged yet.' }),
      el('button', { class: 'btn btn-primary', onclick: () => setTab('game') }, 'Log a Game')
    ]));
    return wrap;
  }

  // Season totals across all of this pitcher's games.
  const allPitches = games.flatMap(g => g.pitches);
  const tot = pitchingLine(allPitches);
  const runsAllowed = games.reduce((sum, g) => sum + gameScore(g).opp, 0);
  wrap.appendChild(el('div', { class: 'card' }, [
    el('h3', { text: 'Season Totals', style: { margin: '0 0 4px' } }),
    el('div', { class: 'muted', style: { marginBottom: '8px' }, text: `${games.length} game${games.length === 1 ? '' : 's'} · ${tot.pitches} pitches` }),
    el('div', { class: 'line-grid' }, [
      lineStat('IP', tot.ip), lineStat('R', runsAllowed), lineStat('K', tot.k),
      lineStat('BB', tot.bb), lineStat('H', tot.h), lineStat('BF', tot.bf),
      lineStat('Strike%', tot.strikePct + '%'), lineStat('Whiff%', tot.whiffPct + '%'), lineStat('AVG', tot.baa)
    ])
  ]));

  // Per-game results log.
  const log = el('div', { class: 'card' }, [el('h3', { text: 'Game Log', style: { margin: '0 0 10px' } })]);
  games.forEach(g => {
    const line = pitchingLine(g.pitches);
    const sc = gameScore(g);
    log.appendChild(el('div', { class: 'gamelog-row' }, [
      el('div', { class: 'glr-top' }, [
        el('span', { class: 'glr-opp', text: `vs ${gameOpponentName(g)}` }),
        el('span', { class: 'glr-score', text: `CHS ${sc.me}–${sc.opp}` }),
        g.final
          ? el('span', { class: 'badge badge-final', text: 'Final' })
          : el('span', { class: 'badge badge-live', text: 'In progress' })
      ]),
      el('div', { class: 'glr-date muted', text: g.date }),
      el('div', { class: 'glr-line', text: `${line.ip} IP · ${line.k} K · ${line.bb} BB · ${line.h} H · ${sc.opp} R` }),
      el('div', { class: 'glr-actions' }, [
        el('button', { class: 'btn btn-sm', onclick: () => {
          state.ui.statsPitcherId = p.id; state.ui.statsGameId = g.id; state.ui.openPitcherId = null;
          setTab('stats');
        } }, 'View stats'),
        !g.final
          ? el('button', { class: 'btn btn-sm', onclick: () => { state.activeGameId = g.id; state.ui.openPitcherId = null; setTab('game'); } }, 'Resume')
          : null
      ])
    ]));
  });
  wrap.appendChild(log);
  return wrap;
}

function lineStat(label, value) {
  return el('div', { class: 'line-stat' }, [
    el('div', { class: 'ls-val', text: String(value) }),
    el('div', { class: 'ls-label', text: label })
  ]);
}

/* ============================ STATS TAB =============================== */

function renderStats() {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'section-head' }, [el('h2', { text: 'Stats' })]));

  if (!state.pitchers.length) {
    wrap.appendChild(el('div', { class: 'empty' }, [
      el('p', { text: 'No pitchers yet.' }),
      el('button', { class: 'btn btn-primary', onclick: () => setTab('pitchers') }, 'Add a Pitcher')
    ]));
    return wrap;
  }

  if (!state.ui.statsMode) state.ui.statsMode = 'season';
  wrap.appendChild(el('div', { class: 'segmented', style: { marginBottom: '14px' } },
    [['season', 'Season'], ['scouting', 'Scouting']].map(([k, lbl]) =>
      el('div', {
        class: 'chip' + (state.ui.statsMode === k ? ' selected' : ''),
        onclick: () => { state.ui.statsMode = k; save(); render(); }
      }, lbl))));

  wrap.appendChild(state.ui.statsMode === 'season' ? renderSeasonStats() : renderScoutingStats());
  return wrap;
}

// Team-wide, season-long pitching stats for all of my pitchers.
function renderSeasonStats() {
  const wrap = el('div');
  const cols = ['Pitcher', 'G', 'IP', 'K', 'BB', 'H', 'R', 'AVG', 'K%', 'Whiff%'];
  const head = el('tr', {}, cols.map((c, i) => el('th', { class: i === 0 ? 'col-name' : '', text: c })));
  const body = el('tbody');

  state.pitchers.forEach(p => {
    const games = pitcherGames(p.id);
    const line = pitchingLine(games.flatMap(g => g.pitches));
    const R = games.reduce((s, g) => s + gameScore(g).opp, 0);
    const kPct = line.bf ? Math.round((line.k / line.bf) * 100) : 0;
    body.appendChild(el('tr', { class: 'season-row', onclick: () => openPitcherProfile(p) }, [
      el('td', { class: 'col-name', text: p.name }),
      el('td', { text: String(games.length) }),
      el('td', { text: line.ip }),
      el('td', { text: String(line.k) }),
      el('td', { text: String(line.bb) }),
      el('td', { text: String(line.h) }),
      el('td', { text: String(R) }),
      el('td', { text: line.baa }),
      el('td', { text: kPct + '%' }),
      el('td', { text: line.whiffPct + '%' })
    ]));
  });

  // Team totals row.
  const allP = state.games.flatMap(g => g.pitches);
  const tl = pitchingLine(allP);
  const tR = state.games.reduce((s, g) => s + gameScore(g).opp, 0);
  body.appendChild(el('tr', { class: 'season-total' }, [
    el('td', { class: 'col-name', text: 'Team' }),
    el('td', { text: String(state.games.length) }),
    el('td', { text: tl.ip }), el('td', { text: String(tl.k) }), el('td', { text: String(tl.bb) }),
    el('td', { text: String(tl.h) }), el('td', { text: String(tR) }), el('td', { text: tl.baa }),
    el('td', { text: (tl.bf ? Math.round((tl.k / tl.bf) * 100) : 0) + '%' }),
    el('td', { text: tl.whiffPct + '%' })
  ]));

  wrap.appendChild(el('div', { class: 'sched-group-label', text: 'Pitching' }));
  wrap.appendChild(el('div', { class: 'season-wrap' }, [el('table', { class: 'season-table' }, [el('thead', {}, [head]), body])]));
  wrap.appendChild(el('p', { class: 'muted', style: { margin: '8px 0 4px', fontSize: '12px' },
    text: 'Tap a pitcher for their full card. R = runs allowed.' }));

  // Hitting table (my hitters with at-bats).
  const batters = state.hitters.filter(h => hitterAtBats(h.id).length);
  if (batters.length) {
    const hCols = ['Hitter', 'AVG', 'OBP', 'SLG', 'OPS', 'AB', 'H', 'HR', 'RBI', 'BB', 'K'];
    const hHead = el('tr', {}, hCols.map((c, i) => el('th', { class: i === 0 ? 'col-name' : '', text: c })));
    const hBody = el('tbody');
    batters.forEach(h => {
      const l = hittingLine(hitterAtBats(h.id));
      hBody.appendChild(el('tr', { class: 'season-row', onclick: () => { state.ui.tab = 'hitters'; state.ui.openHitterId = h.id; save(); setTab('hitters'); } }, [
        el('td', { class: 'col-name', text: h.name }),
        el('td', { text: l.avg }), el('td', { text: l.obp }), el('td', { text: l.slg }), el('td', { text: l.ops }),
        el('td', { text: String(l.ab) }), el('td', { text: String(l.h) }), el('td', { text: String(l.hr) }),
        el('td', { text: String(l.rbi) }), el('td', { text: String(l.bb) }), el('td', { text: String(l.k) })
      ]));
    });
    wrap.appendChild(el('div', { class: 'sched-group-label', style: { marginTop: '18px' }, text: 'Hitting' }));
    wrap.appendChild(el('div', { class: 'season-wrap' }, [el('table', { class: 'season-table' }, [el('thead', {}, [hHead]), hBody])]));
  }
  return wrap;
}

function renderScoutingStats() {
  const wrap = el('div');
  if (!state.games.length) {
    wrap.appendChild(el('div', { class: 'empty' }, [
      el('p', { text: 'No games logged yet.' }),
      el('p', { class: 'muted', text: 'Log some pitches to see zone tendencies.' })
    ]));
    return wrap;
  }

  // pitcher selector
  if (!state.ui.statsPitcherId || !pitcherById(state.ui.statsPitcherId))
    state.ui.statsPitcherId = state.pitchers[0].id;

  const selRow = el('div', { class: 'pill-row' }, state.pitchers.map(p =>
    el('div', {
      class: 'spitch' + (p.id === state.ui.statsPitcherId ? ' selected' : ''),
      onclick: () => { state.ui.statsPitcherId = p.id; state.ui.statsGameId = null; state.ui.statsBatter = null; save(); render(); }
    }, p.name)));
  wrap.appendChild(selRow);

  const pid = state.ui.statsPitcherId;
  const games = state.games.filter(g => g.pitcherId === pid);
  let pitches = games.flatMap(g => g.pitches);

  // game filter
  const gameSel = el('select', { onchange: e => { state.ui.statsGameId = e.target.value || null; save(); render(); } }, [
    el('option', { value: '' }, `All games (${games.length})`),
    ...games.map(g => el('option', { value: g.id, selected: g.id === state.ui.statsGameId },
      `vs ${g.opponent || '—'} · ${g.date}`))
  ]);
  wrap.appendChild(el('div', { class: 'field' }, [gameSel]));

  if (state.ui.statsGameId)
    pitches = pitches.filter(pt => games.find(g => g.id === state.ui.statsGameId)?.pitches.includes(pt));

  // Per-hitter filter: how this pitcher attacked a specific batter she faced.
  const batterKey = pt => pt.batterId ? 'id:' + pt.batterId : (pt.batterName ? 'nm:' + pt.batterName : null);
  const batterMap = new Map();
  pitches.forEach(pt => {
    const k = batterKey(pt);
    if (!k) return;
    if (!batterMap.has(k)) batterMap.set(k, { key: k, name: pt.batterName || 'Unknown', n: 0 });
    batterMap.get(k).n++;
  });
  if (batterMap.size) {
    const batterSel = el('select', { onchange: e => { state.ui.statsBatter = e.target.value || null; save(); render(); } }, [
      el('option', { value: '' }, `All batters faced (${batterMap.size})`),
      ...[...batterMap.values()].sort((a, b) => b.n - a.n).map(b =>
        el('option', { value: b.key, selected: b.key === state.ui.statsBatter }, `${b.name} — ${b.n} pitches`))
    ]);
    wrap.appendChild(el('div', { class: 'field' }, [el('label', { text: 'Vs hitter' }), batterSel]));
    if (state.ui.statsBatter) {
      pitches = pitches.filter(pt => batterKey(pt) === state.ui.statsBatter);
      const ln = pitchingLine(pitches);
      wrap.appendChild(el('div', { class: 'card', style: { padding: '12px 14px' } }, [
        el('div', { style: { fontWeight: '700', marginBottom: '2px' }, text: `${pitches.length} pitches · ${ln.k} K · ${ln.bb} BB · ${ln.h} H` }),
        el('div', { class: 'muted', style: { fontSize: '12px' }, text: `${ln.baa} avg against · ${ln.whiffPct}% whiff` })
      ]));
    }
  }

  // Batter-side filter (All / vs RHB / vs LHB). Affects every section below.
  if (!state.ui.statsHand) state.ui.statsHand = 'all';
  const rhb = pitches.filter(pt => pt.batterHand === 'R').length;
  const lhb = pitches.filter(pt => pt.batterHand === 'L').length;
  const handOpts = [
    { key: 'all', label: `All (${pitches.length})` },
    { key: 'R', label: `vs RHB (${rhb})` },
    { key: 'L', label: `vs LHB (${lhb})` }
  ];
  wrap.appendChild(el('div', { class: 'segmented', style: { marginBottom: '14px' } },
    handOpts.map(o => el('div', {
      class: 'chip' + (state.ui.statsHand === o.key ? ' selected' : ''),
      onclick: () => { state.ui.statsHand = o.key; save(); render(); }
    }, o.label))));

  if (state.ui.statsHand !== 'all')
    pitches = pitches.filter(pt => pt.batterHand === state.ui.statsHand);

  if (!pitches.length) {
    wrap.appendChild(el('div', { class: 'empty' }, [el('p', { text: 'No pitches logged for this selection.' })]));
    return wrap;
  }

  if (!state.ui.statsMetric) state.ui.statsMetric = 'frequency';
  const metricToggle = el('div', { class: 'segmented', style: { marginBottom: '14px' } },
    Object.entries(HEAT_METRICS).map(([key, m]) =>
      el('div', {
        class: 'chip' + (state.ui.statsMetric === key ? ' selected' : ''),
        onclick: () => { state.ui.statsMetric = key; save(); render(); }
      }, m.label)));

  wrap.appendChild(metricToggle);
  wrap.appendChild(statsHeatZone(pitches, state.ui.statsMetric));
  wrap.appendChild(statsCountGrid(pitches));
  wrap.appendChild(statsCountTendencies(pitches));
  wrap.appendChild(statsSummary(pitches));
  wrap.appendChild(statsPitchMix(pitches));
  return wrap;
}

// Per-zone aggregates over the given pitches, used by every heat metric.
function zoneAggregates(pitches) {
  const agg = {};
  ZONES.forEach(z => agg[z.id] = { count: 0, whiffs: 0, swings: 0, hits: 0, bip: 0 });
  pitches.forEach(pt => {
    const a = agg[pt.zone];
    if (!a) return;
    a.count++;
    if (pt.result === 'swing_strike') a.whiffs++;
    if (SWING_RESULTS.includes(pt.result)) a.swings++;
    if (HIT_RESULTS.includes(pt.result)) a.hits++;
    if (IN_PLAY_RESULTS.includes(pt.result)) a.bip++;
  });
  return agg;
}

// Heat-map metrics. Each returns, per zone: whether there's data (`has`), a
// 0..1 color intensity (`t`, blue→red), and the cell `text`.
const HEAT_METRICS = {
  frequency: {
    label: 'Frequency',
    caption: '<strong>Location</strong> — pitch count per zone',
    legend: ['Fewer', 'More'],
    compute: (a, ctx) => ({ has: a.count > 0, t: a.count / ctx.maxCount, text: a.count ? String(a.count) : '' })
  },
  whiff: {
    label: 'Whiff %',
    caption: '<strong>Swing &amp; miss %</strong> — whiffs &divide; swings per zone',
    legend: ['Contact', 'Misses bats'],
    compute: a => ({
      has: a.swings > 0,
      t: a.swings ? a.whiffs / a.swings : 0,
      text: a.swings ? Math.round((a.whiffs / a.swings) * 100) + '%' : '—'
    })
  },
  ba: {
    label: 'Avg against',
    caption: '<strong>Batting avg against</strong> — hits &divide; balls in play per zone',
    legend: ['Weak', 'Gets hit'],
    compute: a => {
      const ba = a.bip ? a.hits / a.bip : 0;
      return { has: a.bip > 0, t: Math.min(1, ba / 0.5), text: a.bip ? ba.toFixed(3).replace(/^0/, '') : '—' };
    }
  }
};

function statsHeatZone(pitches, metricKey) {
  const metric = HEAT_METRICS[metricKey] || HEAT_METRICS.frequency;
  const agg = zoneAggregates(pitches);
  const ctx = { maxCount: Math.max(1, ...ZONES.map(z => agg[z.id].count)) };

  const grid = el('div', { class: 'zone-grid' });
  ZONES.forEach(z => {
    const r = metric.compute(agg[z.id], ctx);
    const cell = el('div', {
      class: `zcell ${z.kind}`,
      style: {
        gridColumn: z.col, gridRow: z.row, border: 'none',
        background: r.has ? heatColor(r.t) : (z.kind === 'strike' ? '#1a1f26' : '#11151b')
      }
    });
    if (r.text && (z.kind === 'strike' || r.has))
      cell.appendChild(el('span', { class: 'zval', style: { fontSize: '13px' }, text: r.text }));
    grid.appendChild(cell);
  });

  return el('div', { class: 'zone-wrap' }, [
    el('div', { class: 'zone-caption', html: metric.caption }),
    grid,
    el('div', { class: 'zone-legend' }, [
      el('span', { html: `<span class="legend-swatch" style="background:#2f6fdb"></span>${metric.legend[0]}` }),
      el('span', { html: `<span class="legend-swatch" style="background:#e23c2e"></span>${metric.legend[1]}` })
    ])
  ]);
}

// blue (low) -> red (high)
function heatColor(t) {
  const x = Math.max(0, Math.min(1, t));
  const blue = [47, 111, 219], red = [226, 60, 46];
  const mix = blue.map((b, i) => Math.round(b + (red[i] - b) * x));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

function statsSummary(pitches) {
  const total = pitches.length;
  const strikeResults = ['called_strike', 'swing_strike', 'foul'];
  const inZone = pitches.filter(pt => ZONES.find(z => z.id === pt.zone)?.kind === 'strike').length;
  const strikes = pitches.filter(pt =>
    strikeResults.includes(pt.result) || IN_PLAY_RESULTS.includes(pt.result)).length;
  const swStrikes = pitches.filter(pt => pt.result === 'swing_strike').length;
  const swings = pitches.filter(pt => SWING_RESULTS.includes(pt.result)).length;
  const balls = pitches.filter(pt => pt.result === 'ball').length;
  const hits = pitches.filter(pt => HIT_RESULTS.includes(pt.result)).length;
  const xbh = pitches.filter(pt => ['double', 'triple', 'hr'].includes(pt.result)).length;
  const bip = pitches.filter(pt => IN_PLAY_RESULTS.includes(pt.result)).length;
  const firstPitch = pitches.filter(pt => pt.balls === 0 && pt.strikes === 0);
  const firstPitchStrikes = firstPitch.filter(pt =>
    strikeResults.includes(pt.result) || IN_PLAY_RESULTS.includes(pt.result)).length;

  const pct = (n, d) => d ? Math.round((n / d) * 100) + '%' : '—';
  const ba = bip ? (hits / bip).toFixed(3).replace(/^0/, '') : '—';

  return el('div', { class: 'card' }, [
    el('h3', { text: 'Summary', style: { margin: '0 0 8px' } }),
    statRow('Total pitches', total),
    statRow('In strike zone', `${inZone} (${pct(inZone, total)})`),
    statRow('Strikes (called/swing/foul/in play)', strikes),
    statRow('Swing & miss (whiff)', `${swStrikes} (${pct(swStrikes, swings)} of swings)`),
    statRow('Balls', `${balls} (${pct(balls, total)})`),
    statRow('First-pitch strikes', pct(firstPitchStrikes, firstPitch.length)),
    statRow('Hits allowed', `${hits}${xbh ? ` (${xbh} XBH)` : ''}`),
    statRow('Avg against (balls in play)', ba)
  ]);
}

function statRow(k, v) {
  return el('div', { class: 'stat-row' }, [el('span', { text: k }), el('span', { class: 'v', text: String(v) })]);
}

function statsPitchMix(pitches) {
  const byType = {};
  pitches.forEach(pt => { byType[pt.pitchType] = (byType[pt.pitchType] || 0) + 1; });
  const total = pitches.length;
  const rows = Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, n]) =>
    statRow(type, `${n} (${Math.round((n / total) * 100)}%)`));
  return el('div', { class: 'card' }, [
    el('h3', { text: 'Pitch Mix', style: { margin: '0 0 8px' } }),
    ...rows
  ]);
}

// Sorted pitch-type counts: [{ type, n, pct }], most-used first.
function pitchMixEntries(pitches) {
  const byType = {};
  pitches.forEach(pt => { byType[pt.pitchType] = (byType[pt.pitchType] || 0) + 1; });
  const total = pitches.length || 1;
  return Object.entries(byType)
    .map(([type, n]) => ({ type, n, pct: Math.round((n / total) * 100) }))
    .sort((a, b) => b.n - a.n);
}

function strikePct(pitches) {
  if (!pitches.length) return null;
  const strikes = pitches.filter(pt =>
    ['called_strike', 'swing_strike', 'foul'].includes(pt.result) || IN_PLAY_RESULTS.includes(pt.result)).length;
  return Math.round((strikes / pitches.length) * 100);
}

// "By count" situational tendencies — the buckets coaches actually game-plan
// around. Buckets overlap on purpose (0-2 is both "ahead" and "two strikes").
const COUNT_SITUATIONS = [
  { label: 'First pitch (0-0)', test: (b, s) => b === 0 && s === 0 },
  { label: 'Ahead (more strikes)', test: (b, s) => s > b },
  { label: 'Even count', test: (b, s) => b === s && !(b === 0 && s === 0) },
  { label: 'Behind (more balls)', test: (b, s) => b > s },
  { label: 'Two strikes (put-away)', test: (b, s) => s === 2 },
  { label: 'Three balls', test: (b, s) => b === 3 },
];

function statsCountTendencies(pitches) {
  const rows = COUNT_SITUATIONS.map(sit => {
    const sub = pitches.filter(pt => sit.test(pt.balls || 0, pt.strikes || 0));
    if (!sub.length) return null;
    const mix = pitchMixEntries(sub).slice(0, 3)
      .map(e => `${e.type} ${e.pct}%`).join(' · ');
    return el('div', { class: 'tend-row' }, [
      el('div', { class: 'tend-head' }, [
        el('span', { class: 'tend-label', text: sit.label }),
        el('span', { class: 'tend-meta', text: `${sub.length} P · ${strikePct(sub)}% strikes` })
      ]),
      el('div', { class: 'tend-mix', text: mix })
    ]);
  }).filter(Boolean);

  return el('div', { class: 'card' }, [
    el('h3', { text: 'By Count', style: { margin: '0 0 4px' } }),
    el('div', { class: 'muted', style: { marginBottom: '6px' }, text: 'Pitch mix by situation (top 3)' }),
    ...rows
  ]);
}

// Exact-count grid (4 ball-rows × 3 strike-cols). Each cell shows that count's
// go-to pitch and how often she throws it — answers "0-2 vs 3-1" directly.
function statsCountGrid(pitches) {
  const maxN = Math.max(1, ...[0, 1, 2, 3].flatMap(b => [0, 1, 2].map(s =>
    pitches.filter(pt => (pt.balls || 0) === b && (pt.strikes || 0) === s).length)));

  const grid = el('div', { class: 'count-grid' });
  // header row: strike columns
  grid.appendChild(el('div', { class: 'count-corner', text: 'B\\S' }));
  [0, 1, 2].forEach(s => grid.appendChild(el('div', { class: 'count-axis', text: `${s} Strk` })));

  [0, 1, 2, 3].forEach(b => {
    grid.appendChild(el('div', { class: 'count-axis', text: `${b} Ball` }));
    [0, 1, 2].forEach(s => {
      const sub = pitches.filter(pt => (pt.balls || 0) === b && (pt.strikes || 0) === s);
      const top = pitchMixEntries(sub)[0];
      const cell = el('div', {
        class: 'count-cell' + (sub.length ? '' : ' empty'),
        style: sub.length ? { background: heatColor(sub.length / maxN) } : {}
      }, [
        el('div', { class: 'cc-count', text: `${b}-${s}` }),
        sub.length
          ? el('div', { class: 'cc-pitch', text: abbr(top.type) })
          : el('div', { class: 'cc-pitch dim', text: '—' }),
        sub.length
          ? el('div', { class: 'cc-sub', text: `${top.pct}% · ${sub.length}P` })
          : null
      ]);
      grid.appendChild(cell);
    });
  });

  return el('div', { class: 'card' }, [
    el('h3', { text: 'Go-To Pitch by Count', style: { margin: '0 0 4px' } }),
    el('div', { class: 'muted', style: { marginBottom: '10px' }, text: 'Most-used pitch in each count (shade = volume)' }),
    grid
  ]);
}

/* ----------------------------- Modal ----------------------------------- */

function openModal(bodyNode) {
  const host = $('#modal-host');
  host.innerHTML = '';
  const sheet = el('div', { class: 'sheet' });
  sheet.appendChild(bodyNode);
  host.appendChild(sheet);
  host.classList.remove('hidden');
  host.onclick = e => { if (e.target === host) closeModal(); };
}

function closeModal() {
  const host = $('#modal-host');
  host.classList.add('hidden');
  host.innerHTML = '';
}

/* ----------------------- Backup / restore ------------------------------ */

function openBackupMenu() {
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', onchange: ev => {
    const f = ev.target.files && ev.target.files[0];
    if (f) importBackup(f);
  } });

  openModal(el('div', {}, [
    el('h3', { text: 'Backup & Restore' }),
    el('p', { class: 'sheet-sub', text: 'Your data lives only on this device. Export a backup to keep it safe or move it to another phone.' }),
    el('div', { class: 'stat-row' }, [el('span', { text: 'Pitchers' }), el('span', { class: 'v', text: String(state.pitchers.length) })]),
    el('div', { class: 'stat-row' }, [el('span', { text: 'Hitters' }), el('span', { class: 'v', text: String(state.hitters.length) })]),
    el('div', { class: 'stat-row' }, [el('span', { text: 'Opponents' }), el('span', { class: 'v', text: String(state.opponents.length) })]),
    el('div', { class: 'stat-row' }, [el('span', { text: 'Games' }), el('span', { class: 'v', text: String(state.games.length) })]),
    el('div', { class: 'stat-row' }, [el('span', { text: 'At-bats' }), el('span', { class: 'v', text: String((state.atbats || []).length) })]),
    el('button', { class: 'btn btn-primary btn-block', style: { marginTop: '16px' }, onclick: exportBackup }, '⬇ Export backup (.json)'),
    el('div', { class: 'field', style: { marginTop: '14px' } }, [
      el('label', { text: 'Restore from a backup file' }), fileInput
    ]),
    el('p', { class: 'muted', style: { fontSize: '12px' }, text: 'Restoring replaces everything currently in the app.' }),
    el('button', { class: 'btn btn-block', style: { marginTop: '8px' }, onclick: closeModal }, 'Close')
  ]));
}

function exportBackup() {
  const payload = {
    app: 'chs-softball-scout', version: 1, exportedAt: new Date().toISOString(),
    pitchers: state.pitchers, hitters: state.hitters, opponents: state.opponents,
    schedule: state.schedule, games: state.games, atbats: state.atbats || []
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `chs-scout-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup exported');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(String(reader.result || '')); }
    catch (e) { toast('Not a valid backup file'); return; }
    if (!data || (!data.pitchers && !data.games)) { toast('Unrecognized backup'); return; }
    const counts = `${(data.pitchers || []).length} pitchers, ${(data.games || []).length} games, ${(data.hitters || []).length} hitters`;
    if (!confirm(`Restore this backup (${counts})? This replaces all current data.`)) return;
    state.pitchers = data.pitchers || [];
    state.hitters = data.hitters || [];
    state.opponents = data.opponents || [];
    state.schedule = data.schedule || [];
    state.games = data.games || [];
    state.atbats = data.atbats || [];
    state.activeGameId = null;
    state.ui = { tab: 'pitchers' };
    save();
    closeModal();
    render();
    toast('Backup restored');
  };
  reader.readAsText(file);
}

/* ----------------------------- Boot ------------------------------------ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

const menuBtn = document.getElementById('menu-btn');
if (menuBtn) menuBtn.addEventListener('click', openBackupMenu);

setTab(state.ui.tab || 'pitchers');
