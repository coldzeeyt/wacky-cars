<div align="center">

# 🏁 WACKY CARS

**A build-your-own-hills physics driving game.**
Play premade maps, earn lug nuts, unlock a permanent speed boost, or build
your own tracks in the Creator — Hill Climb Racing meets a GD-style shell.

![build](https://img.shields.io/badge/build-1.0-e4af2a?style=flat-square)
![no server required](https://img.shields.io/badge/server-none%20yet-37a0d8?style=flat-square)
![runs offline](https://img.shields.io/badge/runs-offline%20%2F%20no%20build%20step-8bd450?style=flat-square)

**[▶ Play it live](https://coldzeeyt.github.io/wacky-cars/)**

</div>

---

## Contents

- [What's in it](#whats-in-it)
- [Controls](#controls)
- [Progress & economy](#progress--economy)
- [Known limitations](#known-limitations)
- [Making it yours](#making-it-yours)
- [Running it](#running-it)
- [Updating GitHub Pages](#updating-github-pages)
- [Project layout](#project-layout)

## What's in it

Built with [Matter.js](https://brm.io/matter-js/) for real two-wheeled car
physics (rigid suspension, weight, momentum) — vendored locally in `js/lib/`
so the whole thing runs from a single static folder with zero build step.

- **Menu** — lug nuts balance, Play, Creator, Codes, and locked "coming soon"
  slots for Cars & Colors, Shop, and Log In (a small **dsg** button in the
  bottom-left opens the Drumstick Games popup; **v1.0** in the bottom-right
  opens the changelog).
- **Play → Select a map** — 12 premade maps, Easy through Demon, read-only.
  Cleared maps get a ✓. Clearing every map unlocks a permanent speed boost.
- **Creator → Search / Create** — Search previews what a real upload feed
  will look like once there's a server; Create is fully working — build,
  save, edit, delete, export/import your own tracks. 14 pieces, picked from
  a grid: the usual slopes/hills/ramps, plus **Bridge** (visually spans
  over the flat ground beneath it — purely cosmetic, drives exactly like
  flat ground), **Key** / **Lock** — a real gameplay mechanic: driving
  over a Key collects it, and a Lock later in the track only opens (and
  consumes one key) if you're holding one — reach a Lock with none and
  it's an instant crash, chain multiple key→lock pairs in one level —
  **Speed** pads (an instant velocity kick, once each), and **Teleport
  In / Teleport Out** pairs (matched in the order they appear in the
  level — the 1st "in" jumps to the 1st "out", and so on).
- A shuffled music playlist (4 tracks) plays through the whole session,
  auto-advancing when each one ends — not a single looping track.
- A procedural, theme-colored two-layer parallax background (soft hill
  silhouettes, scrolling slower than the foreground) runs behind every
  track — no image assets, generated in `js/game.js`.
- **Cars & Colors** — purchasable **Car Types** (a different sprite
  entirely, not just a recolor — starts with the hand-drawn "Sketch" car;
  see `js/cartypes.js`), colors, wraps, and background **Themes**
  (Dusk/Midnight/Sunset/Forest/Aurora), all bought with lug nuts.
  Equipping something you already own is always free.
- **Codes** — redeem one-time codes for lug nuts and other rewards. Codes
  aren't stored as plaintext in the source, so don't go looking there. One
  special code links a Drumstick Games account: it auto-grants every code
  in the registry immediately, and re-checks for any newly added codes
  every time the game loads after that — no need to re-enter anything
  when a future update adds a new one.
- **Starring** — a locked feature for highlighting favorite levels in gold;
  unlocks via a specific code.
- **Play HUD** — a GD-style completion bar (0–100%), gas/brake pedals, reset.

## Controls

| Action | Key | Touch |
|---|---|---|
| Gas | → or D | right pedal |
| Brake / reverse | ← or A | left pedal |
| Reset | R | Reset button |
| Back / close popup | Esc | Back button |

## Progress & economy

Everything lives in `localStorage`, so it survives closing the tab or
restarting the browser — but it's per-device only until there's a real
server (see [Known limitations](#known-limitations)).

- `js/economy.js` owns the lug nuts balance, which levels are cleared, and
  the boost/starring unlock flags. Starting balance and per-difficulty
  rewards are constants at the top of that file.
- The boost is a permanent +12% top speed (`BOOST_MULT` in `js/car.js`),
  applied automatically once earned — either by clearing every premade
  level, or via a code.
- Shop (planned 500–100,000 lug nut car price range) is still a placeholder
  screen — wire it up against `HC.economy` when ready.

## Known limitations

- **No server yet.** Search, Shop, Cars & Colors, and Log In are all
  "coming soon" for the same reason: progress, uploads, and accounts are
  currently local-only. See [`HC.community`](js/levels.js) for the shape a
  real upload feed would take. (A basic Node/Express + Postgres server
  exists as a separate project — see that repo's README for status.)

## Making it yours

| Want to change… | Edit… |
|---|---|
| Premade maps | `HC.levels` in `js/levels.js` |
| Difficulty colors | `HC.DIFF_COLORS` in `js/levels.js` |
| Build number / changelog | `HC.BUILD_VERSION` / `HC.CHANGELOG` in `js/levels.js` |
| Drumstick Games links | `#dsg-popup` in `docs/index.html` |
| Car sprite | drop `docs/assets/car.png`, tune `SPRITE_TARGET_W` in `docs/js/car.js` |
| Music playlist | edit the `PLAYLIST` array in `docs/js/game.js`; drop new files in `docs/assets/` |

## Running it

**Just open it** — double-click `docs/index.html`. Runs straight from
`file://`, no server, no build step.

**Desktop app / .exe — no terminal needed** — go to the repo's **Actions**
tab → **Build Windows EXE** (left sidebar) → **Run workflow** button → **Run
workflow** again to confirm. GitHub builds it on their own servers; takes a
few minutes. When it's done, click into that run and download the
**WackyCars-Windows-Installer** artifact — a zip with your `.exe` inside.
Note: workflow artifacts expire after 90 days, so this is best for testing
builds rather than a permanent public download link (see below for that).

**Desktop app / .exe — with a terminal**
```bash
npm install
npm start          # run in a window
npm run build:win  # Windows installer (.exe) in dist/
npm run build:mac  # macOS .dmg in dist/
```

**For a permanent public download link** (to put on your website or share
long-term): build the `.exe` either way above, then on your repo go to
**Releases → Draft a new release**, tag it (e.g. `v1.0`), and drag the
`.exe` into the "Attach binaries" area before publishing. That gives you a
stable URL like `github.com/coldzeeyt/wacky-cars/releases/latest/download/…`
that never expires, safe to link from anywhere.

## Updating GitHub Pages

Already live at **coldzeeyt.github.io/wacky-cars**. Everything the site
serves lives in one folder, **`docs/`** — that's the whole point of this
layout: update the game by only ever touching what's inside `docs/`.

**One-time setup** (if you haven't already): Settings → Pages → Source →
**Deploy from a branch** → branch `main`, folder **`/docs`** → Save.

**To push a new version:**
1. Open the repo → click into the changed file inside `docs/` (e.g.
   `docs/js/game.js`).
2. Click the pencil (Edit) icon, paste in the new contents, commit.
3. Or use **Add file → Upload files** and drag the whole `docs/` folder
   in at once, in a single commit — the most reliable option, since it
   guarantees every file inside lands together with nothing left over
   from an older version.
4. Pages redeploys automatically within about a minute of any commit to
   `main` — no extra steps needed.

Everything **outside** `docs/` — `package.json`, `electron/`,
`.github/workflows/` — only matters for the desktop `.exe` build and CI,
not the live website. You'll rarely need to touch those.

**Git CLI**, if you set it up locally:
```bash
git add .
git commit -m "describe what changed"
git push
```

## Project layout

Everything GitHub Pages serves lives in **`docs/`** — that's the one
folder to touch for any game update. Everything else at the repo root is
build/CI scaffolding you'll rarely need.

```
docs/index.html         menu / level-select / creator / editor / play / popups
docs/css/style.css       styling (Bungee display, dark / gold / cyan)
docs/js/storage.js       safe localStorage wrapper (never throws)
docs/js/pieces.js        terrain piece definitions
docs/js/levels.js        premade maps + saved-track storage + build/changelog
docs/js/economy.js       lug nuts, completion tracking, boost, starring, codes
docs/js/cosmetics.js     car colors + wraps (purchasable)
docs/js/themes.js        background themes (purchasable)
docs/js/terrain.js       piece list -> polyline -> physics bodies
docs/js/car.js           chassis, wheels, driving, stabilizer, sprite loader
docs/js/editor.js        palette + track name/save/export
docs/js/game.js          engine, screens, camera, rendering, completion bar
docs/js/main.js          boot
docs/assets/             car.png (optional) + music.mp3

electron/main.js         desktop wrapper — loads docs/index.html
package.json             npm scripts + electron-builder config
.github/workflows/       build-exe.yml (builds the .exe on GitHub's servers)
```
