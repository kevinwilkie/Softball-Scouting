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

// Pitch result outcomes and how they affect the count.
const RESULTS = [
  { id: 'ball',          label: 'Ball',          tone: 'ball'   },
  { id: 'called_strike', label: 'Called Strike', tone: 'strike' },
  { id: 'swing_strike',  label: 'Swing & Miss',  tone: 'strike' },
  { id: 'foul',          label: 'Foul',          tone: 'foul'   },
  { id: 'in_play_out',   label: 'In Play — Out', tone: 'out'    },
  { id: 'hit',           label: 'Hit',           tone: 'hit'    },
  { id: 'hbp',           label: 'Hit By Pitch',  tone: 'ball'   },
];

const RESULT_TONE = {
  ball: 'res-ball', called_strike: 'res-strike', swing_strike: 'res-strike',
  foul: 'res-foul', in_play_out: 'res-out', hit: 'res-hit', hbp: 'res-ball'
};
const RESULT_LABEL = Object.fromEntries(RESULTS.map(r => [r.id, r.label]));

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
    batterNo: 1
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

    const resGrid = el('div', { class: 'opt-grid' }, RESULTS.map(r =>
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
      resGrid,
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

  if (!pitches.length) {
    wrap.appendChild(el('div', { class: 'empty' }, [el('p', { text: 'No pitches logged for this selection.' })]));
    return wrap;
  }

  wrap.appendChild(statsHeatZone(pitches));
  wrap.appendChild(statsSummary(pitches));
  wrap.appendChild(statsPitchMix(pitches));
  return wrap;
}

// Heat map over the 9 strike-zone cells: colors by usage frequency,
// echoing the screenshot's blue→red gradient.
function statsHeatZone(pitches) {
  const counts = {};
  ZONES.forEach(z => counts[z.id] = 0);
  pitches.forEach(pt => { if (counts[pt.zone] != null) counts[pt.zone]++; });
  const max = Math.max(1, ...Object.values(counts));

  const grid = el('div', { class: 'zone-grid' });
  ZONES.forEach(z => {
    const c = counts[z.id] || 0;
    const t = c / max; // 0..1
    const cell = el('div', {
      class: `zcell ${z.kind}`,
      style: { gridColumn: z.col, gridRow: z.row, background: heatColor(t, z.kind), border: 'none' }
    });
    if (z.kind === 'strike') {
      cell.appendChild(el('span', { class: 'zval', text: String(c) }));
    } else if (c > 0) {
      cell.appendChild(el('span', { class: 'zval', style: { fontSize: '12px' }, text: String(c) }));
    }
    grid.appendChild(cell);
  });

  return el('div', { class: 'zone-wrap' }, [
    el('div', { class: 'zone-caption', html: '<strong>Location heat map</strong> — pitch count per zone' }),
    grid,
    el('div', { class: 'zone-legend' }, [
      el('span', { html: '<span class="legend-swatch" style="background:#2f6fdb"></span>Fewer' }),
      el('span', { html: '<span class="legend-swatch" style="background:#e23c2e"></span>More' })
    ])
  ]);
}

function heatColor(t, kind) {
  if (t <= 0) return kind === 'strike' ? '#1a1f26' : '#11151b';
  // blue (low) -> red (high)
  const blue = [47, 111, 219], red = [226, 60, 46];
  const mix = blue.map((b, i) => Math.round(b + (red[i] - b) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

function statsSummary(pitches) {
  const total = pitches.length;
  const strikeResults = ['called_strike', 'swing_strike', 'foul'];
  const inZone = pitches.filter(pt => ZONES.find(z => z.id === pt.zone)?.kind === 'strike').length;
  const strikes = pitches.filter(pt => strikeResults.includes(pt.result) ||
    ZONES.find(z => z.id === pt.zone)?.kind === 'strike' && pt.result === 'in_play_out').length;
  const swStrikes = pitches.filter(pt => pt.result === 'swing_strike').length;
  const balls = pitches.filter(pt => pt.result === 'ball').length;
  const hits = pitches.filter(pt => pt.result === 'hit').length;
  const firstPitch = pitches.filter(pt => pt.balls === 0 && pt.strikes === 0);
  const firstPitchStrikes = firstPitch.filter(pt =>
    strikeResults.includes(pt.result) || pt.result === 'in_play_out' || pt.result === 'hit').length;

  const pct = (n, d) => d ? Math.round((n / d) * 100) + '%' : '—';

  return el('div', { class: 'card' }, [
    el('h3', { text: 'Summary', style: { margin: '0 0 8px' } }),
    statRow('Total pitches', total),
    statRow('In strike zone', `${inZone} (${pct(inZone, total)})`),
    statRow('Called/swing strikes & fouls', strikes),
    statRow('Swing & miss', `${swStrikes} (${pct(swStrikes, total)})`),
    statRow('Balls', `${balls} (${pct(balls, total)})`),
    statRow('Hits allowed', hits),
    statRow('First-pitch strikes', pct(firstPitchStrikes, firstPitch.length))
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
