# Carrollton Softball — Pitcher Scout

A lightweight, mobile-first web app for scouting opposing softball pitchers for
Carrollton High School's softball team. Built as a no-backend Progressive Web
App: everything is stored locally on your device (works offline at the field)
and there's nothing to install or sign into.

## Features

### Roster tab
Build a roster of pitchers you want to scout. For each pitcher you can record:
- **Name**
- **Classification** — Freshman / Sophomore / Junior / Senior
- **Handedness** — right- or left-handed
- **Pitch types** — Fastball, Changeup, Curveball, Riseball, Dropball,
  Screwball, Drop Curve, Knuckle (multi-select)

Add, edit, and delete pitchers.

### Log Game tab
Track a live game pitch-by-pitch:
- A **scoreboard** styled like a broadcast overlay — balls, strikes, outs,
  inning, current batter, and tappable bases.
- A **tappable strike zone** (the inner 3×3 squares are the strike zone, the
  outer ring is out-of-zone, just like the screenshot). Tap the spot where the
  pitch crossed the plate.
- After tapping a zone, pick the **pitch type** and the **result** (ball,
  called strike, swing & miss, foul, in play out, hit, hit-by-pitch). The
  count, outs, and innings advance automatically.
- A running **pitch log** with an **Undo last** button.

You can run multiple games and switch between them. Each game is saved.

### Stats tab
- A **location heat map** over the strike zone (blue → red by pitch frequency),
  matching the screenshot's style.
- A **summary** — in-zone %, strike %, swing-and-miss %, balls, hits, and
  first-pitch-strike %.
- A **pitch mix** breakdown by pitch type.

Filter stats by pitcher and by individual game (or all games combined).

## Running it

It's a static site — no build step.

```bash
# from this folder, any static server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000 on your phone or laptop
```

Or deploy the folder to **GitHub Pages** (Settings → Pages → deploy from this
branch) and open the URL on your phone. On iОS/Android tap "Add to Home Screen"
to use it like a native app — it caches offline so it works in the stands with
no signal.

## Data & privacy

All data lives in your browser's `localStorage` on the device you use. Nothing
is uploaded anywhere. Clearing your browser data (or using a different device)
starts fresh.

## Tech

Plain HTML/CSS/vanilla JavaScript — no frameworks, no dependencies. A small
service worker (`sw.js`) provides offline caching.
