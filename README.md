# DON'T PLAY THIS GAME
> A neon-drenched, single-player sci-fi tower defense game. **You were warned.**

**[Launch the game](https://jh124.github.io/Don-t-play-This-Game/)** · [GitHub Pages setup](#deploying)

## Version 3 — Arcade Assault

The default mode is now **Arcade Assault**, a shorter, action-focused single-player tower defense campaign. **Classic Defense** (the original 20-wave campaign) remains selectable on the main menu.

**Arcade Assault adds**
- 12 faster waves, including Titans on waves 4, 8, and 12.
- Automatic wave deployment after a countdown (10 seconds to set up initially; 5 seconds between waves). Starting early grants bonus credits.
- A **player-operated railgun**: press **D**, tap **Take Control**, or use the on-field Aim button; hold and drag to fire. Skillful centered hits do more damage and build a precision streak. Release to cool the gun; sustained fire can overheat it.
- **Combat contracts** with optional money bonuses. These reward manual railgun hits, kill chains, supply collection, flawless defense, and taking on Titans yourself.
- Time-limited **supply drops**: tap them for credits, repairs, cooling, or a whole-field attack. The drops can be collected during combat and between waves while they remain active.
- A **fixed mobile quick-build dock** with all six tower choices, so you can select a tower without scrolling to the armory. The dock disappears outside the game and on wide screens.
- Independent local best scores for Arcade and Classic.

## Previous Command Deck features

Built to be playable with touch or mouse, no server or build process necessary. The entire game is HTML, CSS, and a Canvas 2D combat simulation.

### Campaign

Classic mode offers **20 authored assault waves**, with a **multi-phase Titan boss every fifth wave**. Arcade Assault is a shorter 12-wave alternative. On victory you can continue into infinitely scaling **endless mode**. Each map has a different path and **three power-pad positions** that reward good tower placement.

- **Neon Crossing:** winding industrial routes.
- **Redline Canyon:** long sight lines and sharp turns.
- **Ghost Circuit:** tight reactor corridors.

Difficulty: **Normal**, **Hard**, or **Insane**.

### 6 towers, 12 specializations

| Tower | Cost | Playstyle | Level-3 tech branch choices |
|---|---:|---|---|
| Pulse Cannon | 85¢ | Fast single-target fire | **Target Lock** (ramping focus) / **Ricochet** (bouncing shots) |
| Rail Driver | 180¢ | Piercing beams, armor control | **Titan Breaker** (boss / armor damage) / **Hyper Rail** (more pierce and range) |
| Cryo Emitter | 145¢ | Crowd control | **Absolute Zero** (extreme slow) / **Shatter Point** (makes targets vulnerable to allies) |
| Nova Mortar | 215¢ | Explosions and packed groups | **Napalm Round** (damage over time) / **Cluster Bomb** (extra splash radius) |
| Arc Tesla | 265¢ | Chaining lightning | **Overcharge** (shield / boss damage) / **Chain Reaction** (more chain targets) |
| Credit Mine | 155¢ | Economic investment (max 5) | **Compound Yield** (more credits) / **Tactical Relay** (buffs nearby fire rate) |

All towers reach **level 4**. At level 2, the next upgrade asks you to choose **one** of two mutually exclusive specializations.

Build towers off the road, upgrade them, set target priority (**First, Strong, Last**), and sell them for a 70% credit refund.

### Power pads

Three glowing power pads are located off-road on each map. A tower built directly on one gets a passive boost:

- **Longshot (cyan):** +22% attack range.
- **Quickfire (purple):** +18% fire rate.
- **Warhead (amber):** +22% damage.

### Threat roster

Enemy units include light drones, fast runners, armored brutes, shielders, splitters, phantoms, medics that heal their squad, **jammers** that temporarily disable turrets, and **carriers** that spill reinforcements when destroyed. Titans summon reinforcements, shield allies, and enter an enraged phase below half health.

### Tactical abilities

- **Q — Overdrive:** double tower fire rate for 8 seconds.
- **E — EMP Blast:** freeze currently deployed enemies for 3 seconds.
- **R — Orbital Strike:** choose a point to deal heavy area damage.

The abilities have independent cooldowns, which can be shortened with research.

### Score, bonuses, and long-term challenges

- Earn credits from kills, wave completions, and Credit Mines.
- Maintain quick kill streaks to raise score multipliers.
- Clear a wave without a single reactor hit to earn a **Perfect Defense** payout.
- Earn research choices after waves 3, 6, and 9 in Arcade Assault, or after waves 5, 10, and 15 in Classic. Beating either campaign unlocks endless waves.
- Your mission debrief includes a performance grade, kills, score, perfect waves, and longest kill chain.
- **Eight persistent accolades** give you additional goals on repeat runs. Open Mission Accolades from the main menu.
- Separate Arcade and Classic best scores, accolades, and sound preference are saved to localStorage on the current browser/device.

### Controls

| Action | PC / keyboard | Touch |
|---|---|---|
| Place a tower | Click tower then click open cell; hotkeys **1–6** | Tap tower then tap an open cell |
| Inspect or upgrade | Click placed tower | Tap placed tower |
| Direct-control railgun (Arcade) | **D**, then hold and aim with mouse | Tap **Take Control**, then hold and drag on the field |
| Collect supply drops (Arcade) | Click glowing pickups | Tap glowing pickups |
| Pause | **Space** | Pause button |
| Change speed | **F** | 1× / 2× / 3× toggle |
| Start next wave | **Enter** | Start Wave button |
| Abilities | **Q**, **E**, **R**, then aim orbital strike | Tap ability; tap to aim orbital strike |
| Cancel build / targeting | **Esc** | Tap selected unit again / another tower |

**On iPhone:** Rotate to landscape for a larger game field. The interface reflows for portrait too.

## Deploying

GitHub Pages is supported by the workflow in the .github/workflows/deploy.yml file.

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. If the deploy hasn't run, open **Actions → Deploy tower defense game** and trigger it once.
4. Your game's address is https://jh124.github.io/Don-t-play-This-Game/.

Automatic deployments run on every push to the main branch. You can also download the repository and open index.html directly.

## Source layout

- index.html: game menu, canvas battlefield, status HUD, armory, and dialogs
- styles.css: original responsive game layout
- polish.css: expanded HUD, tech branches, performance grades, and visual polish
- arcade.css: arcade controls, combat contracts, and mobile quick-build dock
- game.js: engine, waves, enemies, upgrades, animations, achievements, and input
- icon.svg: game favicon
- .github/workflows/deploy.yml: GitHub Pages deployment

No ads, purchase mechanics, account requirements, third-party game libraries, or back-end. The display font is loaded from Google Fonts when available; fallback fonts work offline. The game is an original work and is not affiliated with Bloons TD or Star Wars.
