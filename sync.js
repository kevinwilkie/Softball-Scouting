/* ===========================================================================
   Shared-team sync: Google sign-in + real-time Firestore.

   Loads only when firebase-config.js has real values. Otherwise the app runs
   in local-only mode (unchanged). Each top-level data slice (pitchers, hitters,
   opponents, schedule, at-bats, hitter-pitches, games) syncs to its own
   document under the `shared` collection, so different coaches editing
   different things don't collide, and everyone sees changes live.
   =========================================================================== */

(function () {
  'use strict';

  const cfg = window.FIREBASE_CONFIG;
  const configured = cfg && cfg.apiKey && !/PASTE|YOUR_/.test(cfg.apiKey);
  if (!configured) {
    console.info('[sync] Firebase not configured — running local-only.');
    return;
  }

  const SLICES = ['pitchers', 'hitters', 'opponents', 'schedule', 'atbats', 'hitterPitches', 'games'];
  // Games are synced per-game (see attachGames/pushGames) so two coaches logging
  // different games at once never overwrite each other; the rest sync whole-slice.
  const NONGAME_SLICES = SLICES.filter(k => k !== 'games');
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';
  const lastSynced = {};   // key -> JSON we last read/wrote (dedupes echoes)
  const seeded = {};       // key -> have we handled first snapshot
  const timers = {};       // key -> debounce timer
  const lastGames = {};    // gameId -> JSON of the game as last read/written
  let gamesSeeded = false;
  let unsubs = [];
  let db, auth, ready = false, gate;

  loadScripts([
    SDK + 'firebase-app-compat.js',
    SDK + 'firebase-auth-compat.js',
    SDK + 'firebase-firestore-compat.js'
  ]).then(init).catch(e => console.error('[sync] Firebase failed to load', e));

  function loadScripts(urls) {
    return urls.reduce((p, u) => p.then(() => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = u; s.onload = res; s.onerror = () => rej(new Error('load ' + u));
      document.head.appendChild(s);
    })), Promise.resolve());
  }

  function init() {
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); // offline cache
    buildGate();
    showGate('signin');
    auth.onAuthStateChanged(onAuth);
  }

  function onAuth(user) {
    if (!user) { teardown(); showGate('signin'); return; }
    const allow = (window.ALLOWED_EMAILS || []).map(e => e.toLowerCase());
    if (allow.length && !allow.includes((user.email || '').toLowerCase())) {
      teardown(); showGate('denied', user.email); return;
    }
    hideGate();
    attach(user);
  }

  function attach(user) {
    teardown();
    NONGAME_SLICES.forEach(key => {
      const ref = db.collection('shared').doc(key);
      unsubs.push(ref.onSnapshot(snap => {
        const d = (snap.exists && snap.data()) || {};
        const arr = Array.isArray(d.data) ? d.data : [];
        const firstSnap = !seeded[key];
        seeded[key] = true;
        // If the shared copy is empty (missing, or left empty by an earlier
        // session) but THIS device has data, push local up to seed it — never
        // let an empty shared slice wipe a populated local one.
        if (arr.length === 0 && (state[key] || []).length > 0) {
          if (firstSnap) { lastSynced[key] = JSON.stringify(state[key]); writeSlice(key, state[key], user); }
          return;
        }
        const json = JSON.stringify(arr);
        if (json === lastSynced[key]) return; // our own write echoing back
        lastSynced[key] = json;
        state[key] = arr;
        persistLocal();
        if (!modalOpen()) render();
      }, err => console.warn('[sync] snapshot', key, err && err.message)));
    });
    attachGames(user);
    ready = true;
  }

  // Games sync per-game: each game is its own field ("g_<id>") in the shared
  // `games` doc, written with a merge so different games never collide. On
  // snapshot we merge changed games in and drop games deleted remotely, while
  // keeping any local game that hasn't been pushed yet.
  function attachGames(user) {
    gamesSeeded = false;
    Object.keys(lastGames).forEach(id => delete lastGames[id]);
    const ref = db.collection('shared').doc('games');
    unsubs.push(ref.onSnapshot(snap => {
      const d = (snap.exists && snap.data()) || {};
      const incoming = {};
      Object.keys(d).forEach(k => {
        if (k.indexOf('g_') === 0 && d[k] && typeof d[k] === 'object' && d[k].id) incoming[d[k].id] = d[k];
      });
      const incomingIds = Object.keys(incoming);
      const firstSnap = !gamesSeeded;
      gamesSeeded = true;
      // Empty shared games but this device has some → seed shared from local.
      if (incomingIds.length === 0 && (state.games || []).length > 0) {
        if (firstSnap) pushGames(state.games, user);
        return;
      }
      let changed = false;
      // Apply remote adds/updates.
      incomingIds.forEach(id => {
        const js = JSON.stringify(incoming[id]);
        if (lastGames[id] === js) return; // our own write echoing back
        lastGames[id] = js;
        const idx = (state.games || []).findIndex(g => g.id === id);
        if (idx >= 0) state.games[idx] = incoming[id]; else (state.games = state.games || []).push(incoming[id]);
        changed = true;
      });
      // Apply remote deletions: games we'd previously seen that are now gone.
      Object.keys(lastGames).forEach(id => {
        if (incoming[id]) return;
        delete lastGames[id];
        const idx = (state.games || []).findIndex(g => g.id === id);
        if (idx >= 0) { state.games.splice(idx, 1); changed = true; }
      });
      if (changed) {
        if (state.activeGameId && !(state.games || []).some(g => g.id === state.activeGameId)) state.activeGameId = null;
        persistLocal();
        if (!modalOpen()) render();
      }
    }, err => console.warn('[sync] snapshot games', err && err.message)));
  }

  // Push only the games that changed (and field-delete removed ones).
  function pushGames(games, user) {
    const updates = {};
    const seen = {};
    (games || []).forEach(g => {
      if (!g || !g.id) return;
      seen[g.id] = true;
      const js = JSON.stringify(g);
      if (lastGames[g.id] === js) return; // unchanged
      lastGames[g.id] = js;
      updates['g_' + g.id] = g;
    });
    Object.keys(lastGames).forEach(id => {
      if (seen[id]) return;
      delete lastGames[id];
      updates['g_' + id] = firebase.firestore.FieldValue.delete();
    });
    if (!Object.keys(updates).length) return;
    updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    updates.by = (user && user.email) || null;
    db.collection('shared').doc('games').set(updates, { merge: true })
      .catch(e => console.warn('[sync] write games', e && e.message));
  }

  function teardown() {
    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = []; ready = false;
  }

  // Called from app.js save(): push any locally-changed slices up (debounced).
  window.__syncPush = function () {
    if (!ready) return;
    NONGAME_SLICES.forEach(key => {
      const json = JSON.stringify(state[key] || []);
      if (json === lastSynced[key]) return;
      lastSynced[key] = json;
      const snapshot = JSON.parse(json);
      clearTimeout(timers[key]);
      timers[key] = setTimeout(() => writeSlice(key, snapshot, auth.currentUser), 500);
    });
    // Games push per-game (debounced), snapshotting the current array.
    const gamesSnapshot = JSON.parse(JSON.stringify(state.games || []));
    clearTimeout(timers.games);
    timers.games = setTimeout(() => pushGames(gamesSnapshot, auth.currentUser), 500);
  };

  // True when the shared team database is connected and writable (signed in).
  window.__syncReady = function () { return !!(ready && auth && auth.currentUser); };

  // Force-push the roster (hitters + pitchers) to the shared team DB so every
  // signed-in coach sees these players. Overwrites the shared copy of those
  // two slices. Returns false if team sharing isn't active.
  window.__syncPublishRoster = function () {
    if (!window.__syncReady()) return false;
    ['hitters', 'pitchers'].forEach(key => {
      const arr = state[key] || [];
      lastSynced[key] = JSON.stringify(arr);
      writeSlice(key, arr, auth.currentUser);
    });
    return true;
  };

  function writeSlice(key, data, user) {
    db.collection('shared').doc(key).set({
      data: data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      by: (user && user.email) || null
    }).catch(e => console.warn('[sync] write', key, e && e.message));
  }

  function persistLocal() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }
  function modalOpen() { const h = document.getElementById('modal-host'); return h && !h.classList.contains('hidden'); }

  /* ---------------- sign-in gate ---------------- */
  function buildGate() {
    gate = document.createElement('div');
    gate.className = 'auth-gate hidden';
    gate.innerHTML =
      '<div class="auth-box">' +
        '<img src="icon.svg" alt="" class="auth-logo"/>' +
        '<h2>Trojans Pitch Scout</h2>' +
        '<p class="auth-sub">Coaching staff sign-in</p>' +
        '<button class="auth-btn" id="auth-google">Sign in with Google</button>' +
        '<button class="auth-btn ghost hidden" id="auth-switch">Use a different account</button>' +
        '<p class="auth-err" id="auth-err"></p>' +
        '<p class="auth-hint">Tip: open this in <b>Safari</b> or <b>Chrome</b>. If you tapped the link from a text or email, the built-in mini-browser blocks Google sign-in — tap &#8942; or the share icon and choose &ldquo;Open in Safari.&rdquo;</p>' +
      '</div>';
    document.body.appendChild(gate);
    gate.querySelector('#auth-google').addEventListener('click', () => {
      gate.querySelector('#auth-err').textContent = '';
      const p = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(p).catch(e => {
        gate.querySelector('#auth-err').textContent = friendlyAuthError(e);
      });
    });
    gate.querySelector('#auth-switch').addEventListener('click', () => auth.signOut());
  }

  function showGate(mode, email) {
    if (!gate) return;
    gate.classList.remove('hidden');
    const denied = mode === 'denied';
    gate.querySelector('#auth-google').classList.toggle('hidden', denied);
    gate.querySelector('#auth-switch').classList.toggle('hidden', !denied);
    gate.querySelector('#auth-err').textContent = denied
      ? (email || 'This account') + " isn't on the coaching staff list. Ask your admin to add you."
      : '';
  }

  function hideGate() { if (gate) gate.classList.add('hidden'); }

  // Turn raw Firebase auth errors into plain-language guidance.
  function friendlyAuthError(e) {
    const msg = (e && e.message) || '';
    const code = (e && e.code) || '';
    if (/initial state|sessionStorage|storage-partitioned|popup-blocked|cancelled-popup|popup-closed/i.test(msg + code)) {
      return "Sign-in couldn't finish here — this usually means the page opened inside a text/email mini-browser. Tap the ⋮ or share icon and choose “Open in Safari” (or Chrome), then try again.";
    }
    if (/network/i.test(msg + code)) return 'Network problem — check your connection and try again.';
    return msg || 'Sign-in failed. Try again.';
  }
})();
