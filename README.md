# DON'T PLAY THIS GAME

**You were warned.** A fast, neon-drenched, single-player sci-fi tower defense game made for browsers. Everything runs on the client—no account, server, build system, or dependencies required for the game itself.

## Play

**Once GitHub Pages is enabled:** https://jh124.github.io/Don-t-play-This-Game/

To enable the website for the first time:

1. Open this repo's **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Open **Actions → Deploy tower defense game** and run the workflow if it hasn't run automatically.
4. Open the Pages URL shown in your deployment. Subsequent pushes to main deploy automatically.

Alternatively, download the repository and open index.html in your browser. (The optional Google Fonts will fall back gracefully if you're offline.)

## Your mission

Protect your reactor through **20 increasingly difficult waves**, including a boss every five waves. Beating wave 20 unlocks **endless mode**. Earn credits for defeating enemies and completing waves. Between boss waves, choose a permanent research upgrade.

### Maps

- **Neon Crossing** — winding industrial lanes.
- **Redline Canyon** — long, sharp turns.
- **Ghost Circuit** — twisted corridors.

Choose **Normal**, **Hard**, or **Insane** before starting.

### Towers

| Tower | Cost | Specialty |
|---|---:|---|
| Pulse Cannon | 85 | Fast and affordable single-target damage |
| Rail Driver | 180 | Long-range piercing beam |
| Cryo Emitter | 145 | Slows fast enemies |
| Nova Mortar | 215 | Area damage against dense groups |
| Arc Tesla | 265 | Chaining lightning |
| Credit Mine | 155 | Passive income each completed wave (max 5) |

Select a tower in the armory, then click or tap an open tile to build. Tap a built tower to **upgrade it (up to level 4)**, change target priority (**First / Strong / Last**), or sell it for 70% of invested credits. You cannot build on the enemy path.

### Tactical abilities

- **Overdrive** — all towers fire twice as fast for 8 seconds.
- **EMP Blast** — freeze all currently deployed enemies for 3 seconds.
- **Orbital Strike** — select a target location for heavy area damage.

Each ability has a cooldown. Use them at the right time.

### Controls

- **Mouse/touch:** select towers, place on grid, select existing towers.
- **1–6:** select a tower type.
- **Space:** pause/resume.
- **F:** cycle 1×, 2×, 3× speed.
- **Enter:** start the next wave.
- **Esc:** cancel build or orbital strike targeting.

The layout is responsive and supports iPhone and iPad; landscape orientation gives you a larger battlefield on smaller phones.

## About the code

- index.html — UI structure.
- styles.css — interface, effects, and responsive layouts.
- game.js — canvas renderer, combat simulation, enemies, tower mechanics, upgrades, cooldowns and menu interactions.
- icon.svg — warning-symbol favicon.
- .github/workflows/deploy.yml — static GitHub Pages deployment workflow.

Personal best wave and score, along with sound preference, are stored locally in the browser via localStorage. There are no trackers, ads, in-app purchases, or outside game libraries.

## Credits

Original game developed for the Don't Play This Game repository. Not affiliated with Bloons TD or Star Wars.
