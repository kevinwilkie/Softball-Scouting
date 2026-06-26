# Carrollton Softball — Pitcher Scout

A lightweight, mobile-first web app for scouting opposing softball pitchers for
Carrollton High School's softball team. Built as a no-backend Progressive Web
App: everything is stored locally on your device (works offline at the field)
and there's nothing to install or sign into.

## Features

### Pitchers tab
Build a roster of pitchers you want to scout. For each pitcher you can record:
- **Name**
- **Classification** — Freshman / Sophomore / Junior / Senior
- **Handedness** — right- or left-handed
- **Team / Opponent** — optionally link the pitcher to an opponent team
- **Pitch types** — Fastball, Changeup, Curveball, Riseball, Dropball,
  Screwball, Drop Curve, Knuckle (multi-select)

Add, edit, and delete pitchers. **Tap a pitcher to open their player card** —
a profile with season totals and a game-by-game results log (see below). This
works equally well whether you're scouting opposing pitchers or tracking your
own staff.

### Player card (pitcher results)
Selecting a pitcher's name opens their card:
- **Season totals** across all their games — IP, runs allowed, K, BB, H,
  batters faced, strike %, whiff %, and average-against.
- **Game log** — one row per game with the final score (CHS vs opponent) and
  that game's pitching line (e.g. "5.1 IP · 7 K · 1 BB · 3 H · 2 R"), a Final /
  In-progress badge, a **View stats** button (jumps to that game's heat map and
  tendencies) and a **Resume** button for games still in progress.

Runs allowed come from the live score you keep during the game (the opponent's
runs), so the card reflects the actual scoreboard.

When a game is over, tap **End Game** on the scoreboard to mark it *Final* — its
results are saved to the pitcher's card automatically.

### My Team tab (Hitters)
Carrollton's hitters. For each: name, jersey number, bats (R / L / Switch),
and position — the pool you draw your batting order from at game time.

Tap **+ Log AB** to record a plate appearance (single / double / triple / HR /
walk / HBP / strikeout / out / FC / ROE / sacrifice, with optional RBI). Tap a
hitter to open their **card**: season hitting line (AVG, OBP, SLG, OPS, AB, H,
HR, RBI, BB, K, 2B, 3B) and a full at-bat log.

### Opponents tab
Opponent teams, each with its own roster. Open a team to add players (name,
number, bats, position, and a "Pitcher" flag). The opponent's roster is the
pool for *their* batting order during a game.

### Schedule tab
Your team's game schedule. Add games one at a time (date, time, opponent,
home/away, location, notes) or **Import** a whole schedule — upload a `.csv` /
`.txt` file or paste rows, one game per line:

```
2026-03-14, Bremen, home, 5:30 PM, Carrollton HS
2026-03-17, Villa Rica, away, 6:00 PM
```

Dates accept `YYYY-MM-DD` or `M/D/YYYY`, and opponent names that match a team
on the Opponents tab are linked automatically. Upcoming and past games are
grouped; tap **Log game** on an entry to jump straight into logging it (the
opponent and date are pre-filled), and once logged the entry shows the score.

### Log Game tab
Start a game by choosing the **scouting pitcher** and the **opponent** (picking
a pitcher that's linked to a team auto-selects that opponent). Then track the
game pitch-by-pitch:
- A **scoreboard** styled like a broadcast overlay — the running **score**
  (CHS vs opponent), balls, strikes, outs, inning, current batter, and the
  bases. **Baserunners advance automatically** as you log at-bats (hits, walks,
  outs), and the **score auto-tallies** the runs that cross the plate. When a
  play is ambiguous (e.g. a single with a runner on second), a quick **"runs
  scored?"** prompt lets you say how many came around. You can still tap a base
  to fix a runner, or use the **± buttons** to adjust the score by hand.
- A **Lineups** panel where you set both batting orders — your hitters and the
  opponent's — by tapping players to add them in order (tap a slot to remove).
- The scoreboard then shows the **current batter by name** (number, slot, and
  handedness), and advances through the order automatically as at-bats end. A
  **Batting** toggle switches which lineup is at the plate, and the batter's
  handedness auto-fills the R/L split used in stats. (Switch hitters keep a
  manual R/L choice; a "Next ›" button nudges the order for subs.)
- Because you're usually scouting your **own** pitcher, the opponent's lineup
  bats by default — flip the toggle to "Us" if you're charting an opposing
  pitcher facing Carrollton instead.
- A line summary under the scoreboard shows the live pitching line, with an
  **End Game** button to finalize.
- A **tappable strike zone** (the inner 3×3 squares are the strike zone, the
  outer ring is out-of-zone, just like the screenshot). Tap the spot where the
  pitch crossed the plate.
- After tapping a zone, pick the **pitch type** and the **result** (ball,
  called strike, swing & miss, foul, in play out, hit, hit-by-pitch). The
  count, outs, and innings advance automatically.
- A running **pitch log** with an **Undo last** button.

You can run multiple games and switch between them. Each game is saved.

### At-Bat tab (live opponent-pitcher scouting)
Real-time charting of how opposing pitchers attack **your** hitters. Pick the
hitter at the plate, set the opposing pitcher (name + throws R/L + opponent),
then **tap the strike zone** for each pitch and pick its result. As you go it
keeps a live ball/strike count and builds:
- a **heat map** of where that hitter gets pitched (toggle: location frequency,
  their swing-and-miss zones, and where they do damage),
- a **vs RHP / LHP** filter,
- a **"What They're Seeing"** summary (pitches seen, in-zone %, whiff %, hits)
  and the **pitch mix** they're being thrown.

Great for in-game adjustments — see at a glance that a pitcher is pounding a
hitter inside or that she chases low-and-away.

### Stats tab
Two modes via the toggle at the top:

**Season** — team-wide season tables:
- **Pitching** — every pitcher's line (games, IP, K, BB, H, runs allowed,
  average-against, strikeout %, whiff %) with a team totals row.
- **Hitting** — every hitter with logged at-bats (AVG, OBP, SLG, OPS, AB, H,
  HR, RBI, BB, K).

Tap any row to open that player's card.

**Scouting** — per-pitcher analysis for the selected pitcher. Includes a
**Vs hitter** filter to see how the pitcher attacked a specific batter she
faced (their matchup line, heat map, and tendencies). Plus:
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

**Count & batter-handedness tendencies:**
- A **batter-side filter** (All / vs RHB / vs LHB) at the top of the Stats tab
  re-cuts *every* view — heat map, summary, and the tendency cards — so you can
  see how she attacks righties vs. lefties. (Set the batter's side with the
  **Batter bats R / L** toggle on the game scoreboard as you log.)
- **Go-To Pitch by Count** — a 4×3 grid (balls × strikes) showing her most-used
  pitch and how often she throws it in each count, e.g. "on 0-2 she goes
  riseball 70%." Answers "what does she throw on 0-2 vs. 3-1?" at a glance.
- **By Count** — situational pitch mix and strike% for First pitch, Ahead,
  Even, Behind, Two strikes (put-away), and Three balls.

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
is uploaded anywhere.

Use the **⚙ menu** in the top-right to **Export a backup** (downloads a `.json`
file of everything) or **Restore** from one. Export regularly — clearing your
browser data or switching devices otherwise starts fresh, and a backup lets you
move your season to another phone.

## Tech

Plain HTML/CSS/vanilla JavaScript — no frameworks, no dependencies. A small
service worker (`sw.js`) provides offline caching.
