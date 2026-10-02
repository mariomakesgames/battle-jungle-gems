# 💎 Match-3 Game Engine - Jungle Gems

A complete framework for building a professional, extensible Match-3 game using **Phaser 3** and **Vite**. The architecture follows modern software design principles as flexible, maintainable, and ready for complex features (power-ups, boosters, custom board shapes, progression systems).

<p align="center">
  <a href="https://match-3-two.vercel.app/"><strong>▶ Play live on Vercel</strong></a>
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/179cf084-f840-477d-b6cd-3f6830cbd28d" alt="Jungle Gems gameplay" width="360" />
</p>

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Tech stack](#2-tech-stack)
3. [Installation & running](#3-installation--running)
4. [Detailed project structure](#4-detailed-project-structure)
   - [Role of each folder](#role-of-each-folder)
5. [Core feature implementation guide](#5-core-feature-implementation-guide)
   - [Level design (data-driven)](#level-design-data-driven)
   - [Objectives system](#objectives-system)
   - [Special gems (power-ups)](#special-gems-power-ups)
   - [Support items (boosters)](#support-items-boosters)
6. [Event-driven communication](#6-event-driven-communication)
7. [Development roadmap](#7-development-roadmap)

---

## 1. Architecture overview

The project follows four core design principles:

* **Object-oriented programming (OOP):** Every major game piece (gem, blocker, board) is modeled as a class with clear properties and methods. Inheritance is used for variants (e.g. `StoneBlocker` / `RopeBlocker` extend `BaseBlocker`; power-up behavior is centralized in board modules and can be split into dedicated gem classes later).
* **Data-driven design:** All level data layout, objectives, move limits, star timers is defined in separate **JSON** files, fully decoupled from gameplay logic. Designers can create and tweak levels without touching code.
* **Separation of concerns:** Game logic (`GameScene` and `Board`) is completely separate from the user interface (`UIScene`). They communicate through a shared event bus - not direct references.
* **Event-driven communication:** Components do not call each other directly. They **emit** events (e.g. `gemsMatched`) and **listen** for reactions. This reduces coupling and keeps the codebase flexible when adding scenes, UI, or audio.

`Board.js` acts as a facade and composes focused modules (`BoardMatcher`, `BoardPowerups`, `BoardInput`, `BoardState`, `BoardCreator`) so core algorithms stay readable as mechanics grow.

---

## 2. Tech stack

* **Framework:** [Phaser 3](https://phaser.io/)
* **Build tool:** [Vite](https://vitejs.dev/)
* **Language:** JavaScript (ES6+, ES modules)
* **Viewport:** 576 × 1024, `Phaser.Scale.FIT`, centered

---

## 3. Installation & running

**Requirements:** Node.js 16+ (18+ LTS recommended).

1. **Install dependencies:**
    ```bash
    npm install
    ```
2. **Run the development server (hot-reload):**
    ```bash
    npm run dev
    ```
    Default URL: `http://localhost:5173`

3. **Build for production:**
    ```bash
    npm run build
    ```
    Output is written to the `dist/` folder.

4. **Preview the production build locally:**
    ```bash
    npm run preview
    ```

**Deploy:** [match-3-two.vercel.app](https://match-3-two.vercel.app/) - use build command `npm run build`, output directory `dist`.

---

### Language settings

Choose **简体中文**, **English**, or **Tiếng Việt** on the title screen, in Settings on the map, or in the pause menu during a level. The first visit follows the browser language (unsupported languages fall back to English). The choice is saved locally and updates gameplay labels immediately without restarting the level.

Translations live in `src/i18n/LanguageManager.js`; `src/ui/LocalizedUI.js` binds live labels and draws translated labels over the main image-based controls. Decorative artwork is shared across languages. Run `npm test` for language-selection and translation tests.

### Two-player WebRTC

Choose **Play with a friend** on the title screen or map. The host chooses **Create match**, copies the invitation code and sends it to their friend. The friend chooses **Join friend**, pastes the invitation, generates a reply and sends that reply back. The host pastes the reply and connects; both games then enter the same match. Signaling uses this manual exchange, so no room server or account is required.

Both people play on the same board using the two-swap, special-match bonus and ten-round scoring rules. The host validates moves and resolves random refills, then sends board/score snapshots over a reliable WebRTC data channel. The friend sees swap animations and the resolved board. Both sides can pause between swaps. A disconnected peer locks further moves; a new match requires both players to agree. Campaign progress and boosters are separate.

Production must use HTTPS. Default ICE configuration uses Google's public STUN server. Direct connectivity is not guaranteed across restrictive/symmetric NAT; configure an operator-provided TURN service with the public JSON array `VITE_WEBRTC_ICE_SERVERS` (see `.env.example`) and rebuild. TURN entries use standard `urls`, `username` and `credential` fields. These Vite values ship in the browser bundle; use client TURN credentials, never a provider's administration key. No public TURN service is bundled.

`npm test` checks signaling-code decoding and stale/out-of-turn/malformed packet rejection. `python tests/webrtc-smoke.py` opens two independent browser contexts, exchanges real invitations, plays ten rounds and checks synchronization, pause, mutual rematch and disconnect locking. `python tests/online-lobby-smoke.py` checks mobile layout, three languages, map/title entry, fullscreen controls and cleanup. These checks require a running production preview plus Playwright/Chromium. Environments that prohibit direct UDP can supply a reachable test TURN server through the JSON array `JUNGLE_GEMS_TEST_ICE`; the check still uses native WebRTC, with TCP TURN transport when configured. Local loopback relay testing needs a TURN server configured to allow loopback peers; keep that test-only setting off public servers.

### AI duel

Choose **Play vs AI** on the title screen or map to share a fresh board with the computer. Each side gets two valid swaps per turn. A swap that directly forms a 4+, T or L match earns one extra swap (at most one reward per swap); invalid swaps return without spending an opportunity. Cascades and power-up scores belong to the side that initiated the swap, and the turn changes only after the board settles. After both sides finish ten rounds, the higher total wins; equal scores are a draw. Results support replay or return, and pause freezes AI thinking. This mode does not spend campaign boosters or change level progress. The local AI evaluates visible legal swaps and prioritizes special matches and estimated clears, without reading future refills or calling an external service. All labels support Chinese, English and Vietnamese.

Run `npm test` for turn, reward, result, match-shape and AI-selection checks. With production preview running, `python tests/duel-smoke.py` plays a complete ten-round match and checks both sides' bonus swaps, tap/swipe input, AI input locking, pause, results, replay, campaign isolation, three languages and both entry points.

First-time duel players see a five-step interactive tutorial. Practice a normal swap and a four-match bonus, then watch a dimmed AI turn and learn the score rules. Skip or finish to continue the untouched duel; this preference is saved locally. The **How to play** button reopens practice while pausing the current duel and its AI timer. Tutorial labels support all three languages and do not require additional art or audio downloads. Run `python tests/duel-tutorial-smoke.py` against production preview to check practice, persistence, skipping, AI resume and unavailable preference storage.

### Audio compression

Level music and the waterfall loop use full-length AAC-LC copies at 80 kbps, 44.1 kHz stereo under `public/assets/sounds/optimized/`. This is lossy compression; original audio stays in `public/assets/sounds/maps/` for editing. The already low-bitrate map background and short sound effects retain their original encoding. Music still loads after the board becomes playable and replays from cache. Regenerate the playback files with `python scripts/optimize-music.py` (requires ffmpeg and ffprobe); the script checks duration, channel count and full decoding before replacing each output.

### Loading performance

Loading bars follow Phaser's real queue progress. The map and levels start as soon as their assets are ready, with a short fade; no extra minimum loading time is imposed. Level loading reuses the boot background, avoiding six large loading-only images. Replaying a level reuses cached music and VFX textures.

Resources are loaded in stages through `src/utils/AssetGroups.js`:

- Boot and the first visible map section load first, with shared small icons.
- After two idle seconds, only the visible section's decoration and ambient sounds load in a separate worker, with at most two parallel downloads. Scrolling into the upper map loads its background first. Opening a popup or leaving the map cancels optional map downloads; required level-JSON loading uses a separate queue.
- A level loads its core HUD, effects and its own board theme. Music loads independently after the playable board appears; an unavailable or pending track does not block play.
- Pause and win/lose panels load when opened. Shops, spin, friends and settings also load on first use. Reopening uses cached images and audio.

Map and gameplay backgrounds are resampled to 1152×2049 (about 2× the game canvas), then encoded as lossless WebP to reduce download and texture memory. The map retains its original logical dimensions, keeping level/VFX coordinates fixed. Original PNGs remain available for editing. Regenerate the copies with `python scripts/optimize-loading-images.py` (requires Pillow). Phaser is built as a separate hashed chunk so engine code can stay cached across game-only updates.

With Vite or production preview running, `python tests/loading-smoke.py` validates playable entry with music pending, cached replay, theme selection and bounded music cache. `python tests/deferred-assets-smoke.py` checks first-use popup loading, cached reopening and a complete spin. `python tests/streaming-smoke.py` covers map batches, cancellation, scrolling and first-use pause/result panels. These browser checks require Playwright and Chromium; override `CHROMIUM_EXECUTABLE` or `JUNGLE_GEMS_URL` if needed. `npm test` also checks deferred asset paths and cache behavior. Use `python tests/loading-profile.py` against production preview to report cold loading stages; it rejects the development server so debug-code downloads are not mistaken for production payload.

## 4. Detailed project structure

```
/
├── public/
│   └── assets/
│       ├── images/
│       │   ├── ui/             # UI elements (buttons, panels, icons)
│       │   ├── background/     # Scene backgrounds
│       │   ├── gameplay/       # Sprites / atlases for gems, blockers, power-ups
│       │   └── map/            # World map art, level icons
│       ├── sounds/
│       ├── fonts/
│       └── levels/             # JSON level definitions (level_1 … level_9)
├── src/
│   ├── scenes/                 # Main game screens
│   │   ├── BootScene.js        # Minimal boot; assets for Preloader
│   │   ├── TitleScene.js       # Title / entry screen
│   │   ├── PreloaderScene.js   # Loads all game assets + loading bar
│   │   ├── MapScene.js         # World map, level selection
│   │   ├── LevelLoaderScene.js # Transition / load level data before play
│   │   ├── GameScene.js        # Gameplay only - board, no HUD chrome
│   │   ├── UIScene.js          # HUD overlay on GameScene (score, moves, orders…)
│   │   ├── DemoScene.js        # Optional demo (not main flow)
│   │   └── popups/             # Small scenes used as popups
│   │       ├── SettingsPopup.js
│   │       ├── PausePopup.js
│   │       ├── WinPopup.js
│   │       ├── LosePopup.js
│   │       ├── LevelReviewPopup.js
│   │       ├── ShopPopup.js
│   │       ├── SpinPopup.js
│   │       └── FriendPopup.js
│   ├── objects/                # Gameplay logic & visuals in GameScene
│   │   ├── Board.js            # Board facade - wires board modules together
│   │   ├── board/
│   │   │   ├── BoardCreator.js # Grid / gem creation from level JSON
│   │   │   ├── BoardInput.js   # Pointer input, selection, swap
│   │   │   ├── BoardMatcher.js # Match detection, chains
│   │   │   ├── BoardPowerups.js# Power-ups, boosters, cell damage
│   │   │   └── BoardState.js   # State, gravity, refill
│   │   ├── blockers/           # Obstacle types
│   │   │   ├── BaseBlocker.js
│   │   │   ├── StoneBlocker.js
│   │   │   └── RopeBlocker.js
│   │   └── vfx/                # Visual effects managers
│   │       ├── PowerupVFXManager.js
│   │       ├── BoosterVFXManager.js
│   │       └── MapVFXManager.js
│   ├── ui/                     # Reusable UI components
│   │   ├── LevelNode.js        # One level node on the map
│   │   ├── ObjectiveItem.js    # One row in the “Order” panel
│   │   ├── ProgressBar.js      # Loading bar & in-game progress
│   │   └── ResourceDisplay.js  # Currency / resource display
│   ├── managers/               # Global systems (scene-agnostic)
│   │   ├── PlayerDataManager.js# Player progress (levels, stars, coins…) via localStorage
│   │   ├── AudioManager.js     # Music & SFX (volume persisted in Pause)
│   │   └── APIManager.js       # API layer (e.g. future leaderboard)
│   ├── utils/
│   │   ├── constants.js        # GEM_TYPE, SCENE_KEYS, grid size…
│   │   ├── helpers.js          # Shared helpers
│   │   └── SoundAssets.js      # Sound key definitions
│   └── main.js                 # Phaser config & scene registration
├── index.html
├── vite.config.js
└── CODE_ANALYSIS.md            # Extended technical analysis (Vietnamese)
```

### Main scene flow

```
BootScene → TitleScene → PreloaderScene → MapScene
    → LevelLoaderScene → GameScene + UIScene (parallel overlay)
```

Popups are separate Phaser scenes launched on top when needed (pause, win, lose, shop, etc.).

---

### Role of each folder

#### 1. `src/scenes/` - Screens

These are the main “rooms” of the game. Each file is one screen or overlay.

* **`BootScene.js`:** First scene, very light. Its only job is to load assets required by `PreloaderScene` (e.g. loading background, logo).
* **`TitleScene.js`:** Entry / title screen before the full asset load completes the main loop.
* **`PreloaderScene.js`:** **(Loading screen)** Loads **all** remaining game assets, shows a progress bar, then transitions to `MapScene` (with a minimum display time for polish).
* **`MapScene.js`:** **(Level map)**
    * Displays the scrollable world map.
    * Reads `PlayerDataManager` for current level, unlocked levels, and star counts.
    * Instantiates `LevelNode` components from `ui/` for the player to tap.
    * On level select, loads the matching JSON and starts `LevelLoaderScene` → `GameScene` & `UIScene`.
* **`LevelLoaderScene.js`:** Bridge between map and play, loads level payload and hands off to gameplay scenes.
* **`GameScene.js`:** **(Gameplay stage)**
    * The main stage **without** HUD UI.
    * Contains background, border, and the `Board` instance.
    * Handles input (swipe / tap), match resolution, power-up activation, win/lose checks.
* **`UIScene.js`:** **(Gameplay HUD)**
    * Runs **in parallel**, layered on top of `GameScene`.
    * Shows orders, score, moves left, star timer, booster buttons.
    * Listens to game events to refresh the HUD.
* **`popups/`:** Modal-style scenes `PausePopup` (settings + volume), `WinPopup`, `LosePopup`, `ShopPopup`, etc.
* **Leaderboard (planned):** A dedicated leaderboard scene can use `APIManager` and a `PlayerEntry`-style UI row component when added.

#### 2. `src/objects/` - World objects on the gameplay stage

These are the “actors” on the `GameScene` stage.

* **`Board.js`:** Director of the match. Owns grid state, gems, and blockers; orchestrates match-find, gravity, refill, power-ups, and boosters via board modules.
* **`board/`:** Split responsibilities to matching, input, power-ups/boosters, creation, and state/gravity so each file stays focused.
* **`blockers/`:** Obstacle classes. Each type can define `health` or hit rules (how many hits to clear). Stone and Rope are implemented; more types can extend `BaseBlocker`.
* **`vfx/`:** Dedicated effect managers for power-ups, boosters, and map flourishes keeps `GameScene` thinner.

> **Note:** A `gems/` folder with `Gem.js` / `PowerupGem.js` is a natural OOP extension; today, bomb and color-bomb behavior lives primarily in `BoardPowerups.js` with VFX in `PowerupVFXManager.js`.

#### 3. `src/ui/` - Reusable UI building blocks

Instead of redrawing buttons and panels in every scene, shared components are reused.

* **`LevelNode.js`:** One map level button locked / unlocked / star display. `MapScene` creates many instances.
* **`ObjectiveItem.js`:** One objective icon in the “Order” panel (e.g. “collect 20 red gems”). `UIScene` builds the list from level JSON.
* **`ProgressBar.js`:** Used on the preloader and anywhere a fill bar is needed.
* **`ResourceDisplay.js`:** Shows coins or other resources where needed.

> **Planned / pattern:** A base `Button` class (hover, press, click SFX) and `PlayerEntry` for leaderboard rows fit the same pattern when those screens land.

#### 4. `src/managers/` - Global brains

Systems that serve the whole game, not tied to a single scene.

* **`PlayerDataManager.js`:** Reads/writes `localStorage` (or a future server) for progress which levels are cleared, stars, currency. `MapScene`, `WinPopup`, and `UIScene` query it.
* **`AudioManager.js`:** Single place for music and SFX. Scenes call e.g. `AudioManager` helpers instead of loading sounds themselves. Volume is adjustable in `PausePopup`.
* **`APIManager.js`:** HTTP/API wrapper for requests, responses, and errors - intended for leaderboard and online features.

---

## 5. Core feature implementation guide

### Level design (data-driven)

Each level is a JSON file under `public/assets/levels/`.

#### Example `level_x.json` (current schema)

```json
{
  "levelId": 10,
  "maxMoves": 25,
  "starTimes": {
    "startTime": 120,
    "threeStars": 90,
    "twoStars": 60,
    "oneStar": 30
  },
  "objectives": [
    { "target": "gem", "type": "red", "count": 20 },
    { "target": "blocker", "type": "stone", "count": 5 }
  ],
  "gridLayout": [
    [null, 7, 1, 2, 7, null],
    [   7, 1, 2, 3, 4,    7],
    [   1, 2, 3, 4, 1,    2],
    [   2, 3, 4, 1, 2,    3],
    [   7, 4, 1, 2, 3,    7],
    [null, 7, 2, 3, 7, null]
  ],
  "blockerLayout": [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0]
  ],
  "availableGems": ["red", "green", "blue", "purple"]
}
```

* **`gridLayout`:** Represents the play board.
    * **Positive integers (`1`, `2`, …):** Pre-placed gem (or encoded) types.
    * **`0`:** Cell filled with a random gem from `availableGems` at runtime.
    * **`null`:** A hole not part of the board. Enables arbitrary shapes (cross, heart, irregular maps).
* **`blockerLayout`:** Parallel matrix for obstacles (stone, rope, etc.).
* **`maxMoves`:** Move budget (older docs may say `moves` same role).
* **`starTimes`:** Countdown thresholds for 3 / 2 / 1 stars.

---

### Objectives system

The `objectives` array in JSON defines win conditions.

* **`target: "gem"`:** Collect enough gems of a given `type` (color).
* **`target: "blocker"`:** Destroy enough blockers of a given `type` (`stone`, `rope`, …).
* **Flow:** `Board` clears a target → `GameScene` emits `objectiveUpdated` → `UIScene` updates the Order panel and checks completion.

---

### Special gems (power-ups)

Created when the player makes matches larger than three (or specific patterns).

* **Architecture:** OOP-friendly `RocketGem`, `BombGem`, etc. can extend a base `Gem` and override `activate(board)`. **Currently implemented:** Bomb and Color Bomb (plus combos such as Bomb + Bomb clearing a 5×5 area) via `BoardPowerups.js` and `PowerupVFXManager.js`.
* **Logic (conceptual):**
    1. After a match (e.g. match-4), `Board` may not remove every matched cell immediately.
    2. One cell becomes a power-up gem (stripe / bomb / color bomb depending on rules).
    3. On match or tap, `activate(board)` runs the effect clear row/column, blast area, color clear, etc.

---

### Support items (boosters)

Items the player chooses actively (hammer, swap gloves, rocket, shuffle, …).

* **Flow:**
    1. Player taps a booster icon on `UIScene`.
    2. `UIScene` emits `boosterSelected` (e.g. `'hammer'`).
    3. `GameScene` enters booster mode and updates input/cursor feedback.
    4. Player taps a board cell.
    5. `GameScene` calls `board.useBooster('hammer', row, col)` (or equivalent on `BoardPowerups`).
    6. `Board` runs booster logic; VFX may run via `BoosterVFXManager`.
    7. `GameScene` resets to normal play mode.

---

## 6. Event-driven communication

This is the “circulatory system” of the game components stay decoupled.

| Event | Payload | Emitted by | Listened by | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`gemsMatched`** | `{ score, gemType, count }` | `Board` / `GameScene` | `UIScene`, `AudioManager` | Update score; play match SFX |
| **`objectiveUpdated`** | `{ target, type, remaining }` | `GameScene` | `UIScene` | Refresh objective UI |
| **`moveUsed`** | `{ movesLeft }` | `GameScene` | `UIScene` | Update remaining moves |
| **`boosterSelected`** | `boosterType` (e.g. `'hammer'`) | `UIScene` | `GameScene` | Enter booster targeting mode |
| **`levelWin`** | `{}` | `GameScene` | `UIScene` → `WinPopup` | Show victory flow, save progress |
| **`levelLose`** | `{}` | `GameScene` | `UIScene` → `LosePopup` | Show fail screen |

For deeper flow charts (match cascades, combos, damage priority on blockers), see **[CODE_ANALYSIS.md](./CODE_ANALYSIS.md)**.

---

## 7. Development roadmap

| Item | Status |
|------|--------|
| Level select / world map (`MapScene`, `LevelNode`) | ✅ Done |
| Match-3 core (swap, match, gravity, refill, chains) | ✅ Done |
| Power-ups (Bomb, Color Bomb) + VFX | ✅ Done |
| Boosters (Hammer, Swap, Rocket, Shuffle) + VFX | ✅ Done |
| Blockers (Stone, Rope) | ✅ Done (more types planned) |
| Save game (`localStorage` via `PlayerDataManager`) | ✅ Done |
| Live demo on Vercel | ✅ [Play now](https://match-3-two.vercel.app/) |
| Polish level select UI further | 🔲 In progress |
| New blockers (ice, chains, crates…) | 🔲 Planned |
| New power-ups (color bomb variants, paper plane…) | 🔲 Planned |
| Leaderboard scene + `APIManager` integration | 🔲 Planned |
| Performance: texture atlases & object pooling | 🔲 Planned |
| Richer particle effects on explosions | 🔲 Planned |

---

## Further reading

* **[CODE_ANALYSIS.md](./CODE_ANALYSIS.md)** - Module-level breakdown of `Board`, scene lifecycle, constants, and extension notes.

---

<p align="center">
  Built with Phaser 3 & Vite · <a href="https://match-3-two.vercel.app/">Play now</a>
</p>
