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
- A **strike-zone heat map** (blue → red, matching the screenshot's style) with
  a metric toggle:
  - **Frequency** — where she throws most
  - **Whiff %** — where she misses bats (whiffs ÷ swings per zone)
  - **Avg against** — where she gets hit (batting average on balls in play per
    zone) — the most actionable "where is she beatable?" view
- A **summary** — in-zone %, strike %, whiff rate, first-pitch-strike %, hits
  allowed (with extra-base hits), and overall average against.
- A **pitch mix** breakdown by pitch type.

Pitch results are logged with full detail — ball, called strike, swing & miss,
foul, hit-by-pitch, out, and single / double / triple / home run — which is
what powers the whiff and average-against views.

Filter stats by pitcher and by individual game (or all games combined).

## Running it

It's a static site — no build step.

```bash
# from this folder, any static server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000 on your phone or laptop
```

## Deploying to GitHub Pages (automated)

This repo ships a GitHub Actions workflow
(`.github/workflows/deploy-pages.yml`) that publishes the app to GitHub Pages
automatically on every push. **One-time setup:**

1. On GitHub, open the repository → **Settings** → **Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push (or re-run the workflow) — the included workflow runs on pushes to
   `main`/`master` and to the `claude/softball-pitcher-scout-app-pnr73x`
   development branch, and can also be started manually from the **Actions**
   tab via **Run workflow**.
4. When the **Deploy to GitHub Pages** workflow finishes, your app is live at:

   ```
   https://<your-username>.github.io/<repository-name>/
   ```

   The exact URL is also shown in **Settings → Pages** and in the workflow
   run's **deploy** step summary.

> Note: GitHub may restrict Pages deployment to the repository's **default
> branch**. If the workflow is skipped or blocked when run from the
> development branch, merge this branch into `main` (or set it as the default
> branch) and the deploy will run.

On iOS/Android, open that URL and tap **"Add to Home Screen"** to use it like a
native app — it caches offline so it works in the stands with no signal.

## Data & privacy

All data lives in your browser's `localStorage` on the device you use. Nothing
is uploaded anywhere. Clearing your browser data (or using a different device)
starts fresh.

## Tech

Plain HTML/CSS/vanilla JavaScript — no frameworks, no dependencies. A small
service worker (`sw.js`) provides offline caching.
