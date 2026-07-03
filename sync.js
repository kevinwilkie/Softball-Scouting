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
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';
  const lastSynced = {};   // key -> JSON we last read/wrote (dedupes echoes)
  const seeded = {};       // key -> have we handled first snapshot
  const timers = {};       // key -> debounce timer
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
    SLICES.forEach(key => {
      const ref = db.collection('shared').doc(key);
      unsubs.push(ref.onSnapshot(snap => {
        if (!snap.exists) {
          // Seed the shared copy from this device's data the first time.
          if (!seeded[key]) {
            seeded[key] = true;
            const local = state[key] || [];
            if (local.length) writeSlice(key, local, user);
          }
          return;
        }
        seeded[key] = true;
        const d = snap.data() || {};
        const arr = Array.isArray(d.data) ? d.data : [];
        const json = JSON.stringify(arr);
        if (json === lastSynced[key]) return; // our own write echoing back
        lastSynced[key] = json;
        state[key] = arr;
        persistLocal();
        if (!modalOpen()) render();
      }, err => console.warn('[sync] snapshot', key, err && err.message)));
    });
    ready = true;
  }

  function teardown() {
    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = []; ready = false;
  }

  // Called from app.js save(): push any locally-changed slices up (debounced).
  window.__syncPush = function () {
    if (!ready) return;
    SLICES.forEach(key => {
      const json = JSON.stringify(state[key] || []);
      if (json === lastSynced[key]) return;
      lastSynced[key] = json;
      const snapshot = JSON.parse(json);
      clearTimeout(timers[key]);
      timers[key] = setTimeout(() => writeSlice(key, snapshot, auth.currentUser), 500);
    });
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
      '</div>';
    document.body.appendChild(gate);
    gate.querySelector('#auth-google').addEventListener('click', () => {
      gate.querySelector('#auth-err').textContent = '';
      const p = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(p).catch(e => { gate.querySelector('#auth-err').textContent = e.message; });
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
})();
