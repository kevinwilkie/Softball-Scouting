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
  pitchers: [],     // {id, name, classification, hand, pitches:[]}
  games: [],        // {id, date, opponent, pitcherId, pitches:[...], inning, half, outs, balls, strikes, bases, batter, atBatStart}
  activeGameId: null,
  ui: { tab: 'roster', statsPitcherId: null, statsGameId: null }
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
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
const activeGame = () => state.games.find(g => g.id === state.activeGameId) || null;

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
  if (state.ui.tab === 'roster') root.appendChild(renderRoster());
  else if (state.ui.tab === 'game') root.appendChild(renderGame());
  else if (state.ui.tab === 'stats') root.appendChild(renderStats());
  window.scrollTo(0, 0);
}

/* ============================ ROSTER TAB =============================== */

function renderRoster() {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'section-head' }, [
    el('h2', { text: 'Roster' }),
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
  return el('div', { class: 'card' }, [
    el('div', { class: 'pitcher-card' }, [
      el('div', { class: `pitcher-num hand-${p.hand}`, text: initials || '?' }),
      el('div', { class: 'pitcher-info' }, [
        el('h3', { text: p.name }),
        el('div', { class: 'pitcher-meta',
          text: `${p.classification ? fmtClass(p.classification) + ' · ' : ''}${p.hand === 'L' ? 'Left-handed' : 'Right-handed'}` }),
        p.pitches && p.pitches.length
          ? el('div', { class: 'pitch-tags' }, p.pitches.map(pt => el('span', { class: 'pitch-tag', text: pt })))
          : el('div', { class: 'pitcher-meta muted', text: 'No pitches recorded' })
      ])
    ]),
    el('div', { class: 'card-actions' }, [
      el('button', { class: 'btn btn-sm', onclick: () => openPitcherForm(p) }, 'Edit'),
      el('button', { class: 'btn btn-sm btn-danger', onclick: () => deletePitcher(p) }, 'Delete')
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

  const body = el('div', {}, [
    el('h3', { text: existing ? 'Edit Pitcher' : 'Add Pitcher' }),
    el('div', { class: 'field' }, [el('label', { text: 'Name' }), nameInput]),
    el('div', { class: 'field' }, [el('label', { text: 'Classification' }), classSelect]),
    el('div', { class: 'field' }, [el('label', { text: 'Handedness' }), handSeg]),
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

/* ============================ GAME TAB ================================ */

function newAtBat() {
  return { balls: 0, strikes: 0 };
}

function createGame(pitcherId, opponent, date) {
  const g = {
    id: uid(),
    pitcherId,
    opponent: opponent || '',
    date: date || new Date().toISOString().slice(0, 10),
    pitches: [],
    inning: 1,
    half: 'top',
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: [false, false, false], // 1B, 2B, 3B
    batterNo: 1,
    batterHand: 'R' // which side the current batter hits from
  };
  state.games.push(g);
  state.activeGameId = g.id;
  save();
  return g;
}

function renderGame() {
  const wrap = el('div');
  const g = activeGame();

  if (state.pitchers.length === 0) {
    wrap.appendChild(el('div', { class: 'empty' }, [
      el('p', { text: 'Add a pitcher to the roster first.' }),
      el('button', { class: 'btn btn-primary', onclick: () => setTab('roster') }, 'Go to Roster')
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
      el('div', { class: 'muted', text: `vs ${g.opponent || 'Opponent'} · ${g.date}` })
    ]),
    el('button', { class: 'btn btn-sm', onclick: () => { state.activeGameId = null; save(); render(); } }, 'Games')
  ]));

  wrap.appendChild(scoreboard(g));
  wrap.appendChild(strikeZonePanel(g));
  wrap.appendChild(pitchLog(g));
  return wrap;
}

function renderGamePicker() {
  const box = el('div');

  // start new game form
  const pitcherSelect = el('select', {},
    state.pitchers.map(p => el('option', { value: p.id }, `${p.name} (${p.hand})`)));
  const oppInput = el('input', { type: 'text', placeholder: 'Opponent', autocomplete: 'off' });
  const dateInput = el('input', { type: 'date', value: new Date().toISOString().slice(0, 10) });

  box.appendChild(el('div', { class: 'card' }, [
    el('h3', { text: 'Start New Game', style: { margin: '0 0 12px' } }),
    el('div', { class: 'field' }, [el('label', { text: 'Pitcher' }), pitcherSelect]),
    el('div', { class: 'field' }, [el('label', { text: 'Opponent' }), oppInput]),
    el('div', { class: 'field' }, [el('label', { text: 'Date' }), dateInput]),
    el('button', { class: 'btn btn-primary btn-block', onclick: () => {
      createGame(pitcherSelect.value, oppInput.value.trim(), dateInput.value);
      render();
    } }, 'Start Game')
  ]));

  if (state.games.length) {
    box.appendChild(el('div', { class: 'log-head' }, [el('div', { class: 'muted', text: 'Continue a game' })]));
    [...state.games].reverse().forEach(g => {
      const p = pitcherById(g.pitcherId);
      box.appendChild(el('div', { class: 'game-row' }, [
        el('div', {}, [
          el('div', { class: 'gr-main', text: p ? p.name : 'Unknown' }),
          el('div', { class: 'gr-sub', text: `vs ${g.opponent || '—'} · ${g.date} · ${g.pitches.length} pitches` })
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
    el('div', { class: 'sb-top' }, [
      el('div', { class: 'sb-stat' }, [el('span', { class: 'sb-label', text: 'BALLS' }), dots(g.balls, 4, 'fill-green')]),
      el('div', { class: 'sb-stat' }, [el('span', { class: 'sb-label', text: 'STRIKES' }), dots(g.strikes, 3, 'fill-yellow')]),
      el('div', { class: 'sb-stat' }, [el('span', { class: 'sb-label', text: 'OUTS' }), dots(g.outs, 3, 'fill-red')])
    ]),
    el('div', { class: 'sb-bottom' }, [
      el('div', { class: 'sb-inning' }, [
        `${g.half === 'top' ? '▲' : '▼'} Inn ${g.inning}  `,
        el('small', { text: `· Batter #${g.batterNo}` })
      ]),
      basesEl
    ]),
    el('div', { class: 'sb-hand' }, [
      el('span', { class: 'sb-label', text: 'BATTER BATS' }),
      el('div', { class: 'segmented hand-seg' }, ['R', 'L'].map(h =>
        el('div', {
          class: 'chip' + ((g.batterHand || 'R') === h ? ' selected' : ''),
          onclick: () => { g.batterHand = h; save(); render(); }
        }, h === 'R' ? 'Right' : 'Left')))
    ])
  ]);
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
    batterHand: g.batterHand || 'R',
    ts: Date.now()
  };
  g.pitches.push(pitch);
  applyCount(g, resultId);
  save();
  closeModal();
  render();
  toast(`${pitchType} · ${RESULT_LABEL[resultId]}`);
}

// Advance balls/strikes/outs/innings based on the result.
function applyCount(g, resultId) {
  const endAtBat = () => { g.balls = 0; g.strikes = 0; g.batterNo += 1; };
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
      if (g.balls >= 4) endAtBat(); // walk
      break;
    case 'called_strike':
    case 'swing_strike':
      g.strikes += 1;
      if (g.strikes >= 3) { recordOut(); endAtBat(); } // strikeout
      break;
    case 'foul':
      if (g.strikes < 2) g.strikes += 1;
      break;
    case 'in_play_out':
      recordOut(); endAtBat();
      break;
    case 'single':
    case 'double':
    case 'triple':
    case 'hr':
    case 'hit':
    case 'hbp':
      endAtBat();
      break;
  }
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
        el('div', { class: 'log-sub', text: `Inn ${pt.inning} · ${pt.balls}-${pt.strikes} count · Batter #${pt.batterNo}` })
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
  g.batterNo = 1; g.bases = [false, false, false];
  const pitches = g.pitches;
  g.pitches = [];
  pitches.forEach(pt => {
    pt.inning = g.inning; pt.half = g.half; pt.balls = g.balls;
    pt.strikes = g.strikes; pt.outs = g.outs; pt.batterNo = g.batterNo;
    g.pitches.push(pt);
    applyCount(g, pt.result);
  });
}

/* ============================ STATS TAB =============================== */

function renderStats() {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'section-head' }, [el('h2', { text: 'Stats' })]));

  if (!state.pitchers.length || !state.games.length) {
    wrap.appendChild(el('div', { class: 'empty' }, [
      el('p', { text: 'No game data yet.' }),
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
      onclick: () => { state.ui.statsPitcherId = p.id; state.ui.statsGameId = null; save(); render(); }
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

/* ----------------------------- Boot ------------------------------------ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

setTab(state.ui.tab || 'roster');
