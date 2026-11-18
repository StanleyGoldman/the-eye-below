# The Eye Below

A first-person, real-time, grid-step dungeon crawler for one character,
with roguelike rules: unidentified potions and scrolls, blessings and
curses, and statuses that change what your actions do. Twenty-five
levels down, the magus Morvane keeps the Unblinking Eye. Take it.

It runs by opening `index.html` in a browser. No server, no network.

## Play

```
make build
```

Then open `index.html` (double-click it, or drag it into a browser).
`make build` needs Node 24 or newer; the first run installs the npm
packages from the registry.

| Key | Does |
|---|---|
| W / S, Up / Down | step forward / back |
| A / D | sidestep left / right |
| Q / E, Left / Right | turn |
| Space | attack with the weapon in hand (fires a bow) |
| F, Enter | use what is ahead: doors, switches, fountains, altars, talking |
| G, comma | pick up |
| T | throw the first throwable weapon in the pack |
| R | rest (time runs fast; impossible with a monster in view) |
| C | spell list, then a letter to cast |
| I | inventory, then an item's letter, then an action's letter |
| M | full map |
| N | mute or unmute music and effects |
| Esc | pause menu; also closes whatever is open |

Every key can be changed under Settings, which also has separate
volume sliders for music and for effects. Sound starts with your
first key press or click, never before. Every button on screen has a
tooltip, as does every item, stat, and status.

A run is defined by its seed and its modifiers. The new-game screen
shows both, lets you change any modifier, and gives a short run code
(for example `EB1.candle.mc7tr2`) that reproduces the run exactly when
pasted into the same screen.

## What is in this version

Version 1.0, "Full dark" (git tag `session-3`): the finished game.
Animated, with music and sound, and with the last of the treasure.
Version 0.2 (tag `session-2`) is the same game silent and without
animation frames; version 0.1 (tag `session-1`) is the code-drawn
game.

New in 1.0:

- **Animation.** 30 frames edited from the base pictures: an attack
  pose for each of 25 monsters and characters, a door half open and
  open, a raised portcullis, a thrown switch, a second torch flame.
  The frames of one animation share one crop, so nothing jumps.
- **Music and sound.** Ten pieces of music (the title, one loop for
  each of the five tiers, a boss track for levels whose boss is
  alive, a calm theme inside shops and at a priest's side, and short
  pieces for death and victory) and 27 sound effects (steps, blows,
  six kinds of monster voice, doors, keys, potions, scrolls, wands,
  spells, coins, chests, the shop bell). Played with plain audio
  elements; a file that is missing is silence. **None of it has
  been heard by anyone:** it was generated and measured, not
  listened to. `docs/final-report.md` lists every file.
- **Chests and large boxes.** Some locked, some trapped (a needle,
  sleeping gas, a blinding flash). A chest key opens a lock and is
  used up; forcing the lid can fail, makes noise, and may break the
  potions inside.
- **Vaults.** Now and then a small sealed room of gold off the
  route, behind a hidden door or a switch elsewhere on the level.
  Hidden doors look like wall until you walk into one, use one, or
  stand beside one for a while; a blessed scroll of magic mapping
  shows them. Linger in a vault and its guard arrives and asks who
  you are. The truth costs you the vault's gold and an escort out. A
  lie may be believed, more often if you are lucky or a rogue; if it
  is not, you have a fight.
- **Gems, and glass.** Six kinds of gem and six of worthless glass
  in the same colours, alike until identified. A shopkeeper's price
  tells them apart. Gems count toward the score.
- **Graves,** with epitaphs. The character you last lost is buried
  on the level where they fell, in the next run on the same browser.

From 0.2 and unchanged:

- **Generated art.** 109 images made through the local ComfyUI
  (walls, floors, and ceilings for five tiers; 31 monsters and
  characters; doors, gates, stairs, fountains, altars, chests; 36
  item icons; portraits; the HUD frame, slots, buttons, panels; the
  title), cut out, scaled down, and mapped to one shared 64-colour
  palette. Every image has its prompt, seed, and settings on record
  under `raw/`. If a file is missing the game draws that thing in
  code instead, exactly as 0.1 did.
- **Shops.** Six kinds (general store, weapons, armor, apothecary,
  scrolls and books, and Old Wick's lamp shop), each a room with one
  door and its keeper beside it. The buy and sell panel stops the
  world clock. Prices follow what a thing really is, so they are a
  clue; selling pays half. Shopkeepers do not serve the invisible,
  and attacking one is close to suicide.
- **Peaceful folk.** Temple priests who give protection for a large
  enough offering; hermits, lost adventurers, and gnomes who pass on
  rumors, some true and some not, some of them about this very
  dungeon. Killing a peaceful character costs luck and turns every
  shopkeeper hostile.
- **The oil lamp,** which Old Wick sells: lit, you see further.
- 17 modifiers in all.

From 0.1 and unchanged:

- 25 levels in five tiers, generated from the seed, each verified
  solvable before it is used. Rooms, corridors, plain doors, coloured
  locked doors and their keys, wall switches and pressure plates that
  open gates, and now and then a bone key for a door one level down.
- Five hand-built special levels: the Oracle's Court (5), the
  Stoneyard boulder puzzle with its reset (10), the Gorgon's Isle
  (15), the Keep with its drawbridge (20), the Hollow Tower (25).
- A real-time world: monsters move and attack on their own clocks,
  attacks are telegraphed, and stepping out of reach is a tactic.
  Weapons have cooldowns, shown on the hand slots.
- Three roles (Valkyrie, Wizard, Rogue) with their own kits; d20
  to-hit against armor class; experience levels; spells from
  spellbooks, cast for power; resting.
- 14 weapons, 12 pieces of armor, 11 potions, 8 scrolls, 6 wands, 11
  spells, 6 rings, 5 amulets. Every potion and scroll does something
  different blessed, uncursed, and cursed, and scrolls again when
  read confused.
- 11 statuses with on-screen chips and tooltips, and their effects on
  moving, reading, casting, and drinking.
- 20 regular monsters and several special ones, some with rules of
  their own (floating eye, cockatrice, acid blob, troll, stalker,
  leprechaun, wraith, Medusa).
- Fountains (drink, dip), altars (pray, test for curses), holy and
  unholy water, the oracle and its paid true answers, traps.
- Automap in ASCII, always-on minimap, message log, on-screen
  movement and action buttons, key rebinding, autosave and continue,
  tombstone and victory screens with score and run code.

Nothing in `PROMPT.md` is left undone. Known flaws in single
assets are listed in `docs/asset-review.md`.

## Build, test, check

`make help` lists everything. The ones that matter:

| Target | Does |
|---|---|
| `make build` | bundles `src/` into `dist/game.js` (only when a source changed) |
| `make test` | generator, determinism, and rules tests |
| `make sweep` | generates 3,300 levels across all 17 modifiers and checks each is solvable |
| `make play` | the browser smoke run; screenshots in `out/shots/smoke/` |
| `make assets` | generates and post-processes every asset in the manifest (images, frames, music, effects); skips what exists |
| `make sheet` | contact sheets in `out/sheets/`: every image by kind, and one sheet per animation |
| `make report` | rewrites `docs/asset-review.md` and `docs/final-report.md` from the generation records |
| `make comfy-up`, `make comfy-down` | start ComfyUI; stop it (only the instance this build started) |
| `make clean-assets` | removes processed assets; never touches `raw/` |
| `make check` | typecheck, tests, build, smoke run. Run before every commit |
| `make goal-check SESSION=3` | every acceptance check for a session, one PASS or FAIL line each |
| `make clean` | removes build output only |

The browser script drives the installed Google Chrome through
`playwright-core`; nothing is downloaded.

## Scripts

All in `scripts/`, run with `node`. Each prints what it did and exits
non-zero on failure; `--help` prints usage.

| Script | Does |
|---|---|
| `scripts/build.ts` | bundles the game with esbuild, writing atomically |
| `scripts/play.ts` | headless browser run. `--scenario smoke`, `victory`, `death`, `specials`, `economy`, `assets`, `treasure`, `audio`, or `keys` with `--seed`, `--role`, `--mods id=n,...`, `--level n`, `--keys "KeyW,KeyQ,..."`, `--out dir`, `--god`, `--headed` |
| `scripts/dump-level.ts` | prints a generated level as ASCII with keys, doors, and switches marked: `--seed s --level n [--mods ...] [--monsters]`, or `--all` for a line per level |
| `scripts/sweep.ts` | the solvability sweep behind `make sweep` |
| `scripts/determinism.ts` | generates a seed in two separate processes and compares level hashes |
| `scripts/audit.ts` | counts the game's content and checks the effect table and the ASSETS table |
| `scripts/solve-boulders.ts` | solves the Stoneyard puzzle and prints the solution stored in `src/dungeon/special.ts`; run again if the template changes |
| `scripts/goal-check.ts` | runs a session's acceptance checks (`make goal-check`) |
| `scripts/comfy.ts` | everything that talks to ComfyUI. `up`, `down`, `status`; one command per workflow (`image`, `fast`, `style`, `edit`, `cutout`, `music`, `sfx`) taking `--prompt`, `--seed`, `--size` or `--duration`, `--input`, `--out`; and for manifest assets `gen`, `cut`, `keep`, `regen`, `fallback` with `--id`. Writes a generation record for every job |
| `scripts/process.ts` | post-processes one raw file into its final asset: `--id asset`. Images and frames are cleaned, cropped (frames of one animation with one shared box), scaled, and mapped to the palette; music and effects have their silence trimmed and their loudness set |
| `scripts/gen-rules.ts` | writes `make/assets.mk` and `make/entries/` from the manifest |
| `scripts/sheet.ts` | builds the contact sheets, including one per animation; `--only kind` for one kind |
| `scripts/audit-assets.ts` | checks assets against the manifest: `--manifest`, `--files image frame music sfx`, `--pixels`, `--audio`, `--records`, `--workflows` |
| `scripts/report.ts` | writes `docs/asset-review.md` and `docs/final-report.md` from the generation records and `assets/review.json`; `--print` also prints the report |

## Debugging

Add `?debug=1` to the page address for a `window.__eye` object
(`info()`, `runBot(mode, gameMs)`, `auto(mode)`, `speed(n)`,
`vantage()`, `goto(what)`, `assets()`, `audio()`, `gold(n)`) and an "unkillable" checkbox on the new-game screen.
With `&start=1` the page skips the menus:

```
index.html?debug=1&start=1&seed=candle&role=wizard&level=15&god=1
```

`&noassets=1` plays on code-drawn art alone. `&noaudio=1` plays in
silence without loading any audio.

## Regenerating assets

All art and audio come from a local ComfyUI at `127.0.0.1:8188`, through the
seven workflow files in `workflows/`. Nothing else is contacted.

- `assets/manifest.json` lists every asset: id, workflow, prompt
  (a subject plus named fragments), seed, size, and whether it is
  transparent. `assets/prompts.json` holds the shared fragments,
  including the one STYLE string every image prompt ends with, and
  the shared 64-colour palette.
- `make assets` does everything, one workflow at a time: base images
  (Flux 2, Z-Image), style-matched sprites (Krea-2, using the newt as
  the style reference), animation frames (Qwen edit, each from its
  base picture), cutouts (BiRefNet), music (ACE-Step), sound effects
  (Stable Audio), then post-processing. It
  starts ComfyUI if it is not running, skips whatever already exists,
  and can be run again after an interruption. `make comfy-down`
  stops the server afterward.
- To change one asset, edit its manifest entry and run `make assets`:
  only that asset is regenerated. To reject a result without changing
  the prompt: `node scripts/comfy.ts regen --id X --note "why"`. To
  choose between Krea-2's two candidates:
  `node scripts/comfy.ts keep --id X --attempt 2 --note "why"`. An
  asset gets three attempts; after that
  `node scripts/comfy.ts fallback --id X --note "why"` records it as
  a fallback and the game uses its code-drawn art.
- `make sheet` puts contact sheets in `out/sheets/`: every processed
  image by kind, each animation's frames side by side, and every
  attempt of assets that had more than one.
- Audio cannot be reviewed by the agent that builds it. Post-
  processing fails a file that is silent, the wrong length, or holds
  less than 0.2 s of sound, and that is all that is checked. After
  regenerating audio, listen to it. `make report` rewrites the list
  of files and their measurements in `docs/final-report.md`, and
  the verdict table in `docs/asset-review.md`; remarks on single
  assets go in `assets/review.json`.
- `raw/` keeps every attempt, kept or rejected, and beside each
  asset a JSON record: the workflow exactly as submitted, prompt,
  seed, models, steps, size, reference image, ComfyUI prompt id,
  time taken, why rejected attempts were rejected, and what
  post-processing did. `raw/generation-log.jsonl` has one line per
  job. `make clean-assets` removes processed files only, so
  `make assets` can rebuild them from `raw/` without ComfyUI.
- After a fresh clone, file times are arbitrary and make may think
  cutouts are stale. `make settle` puts the timestamps in dependency
  order without running any job.

## Layout

```
index.html        entry point, loads dist/game.js
src/core/         seeded random numbers, modifiers, run codes
src/dungeon/      generator, special levels, solvability check (no DOM)
src/game/         state, rules, effect table, monsters, bot, saving (no DOM)
src/assets/       the ASSETS table, code-drawn art, and file loading
src/audio/        music and sound effects
assets/           manifest, prompts, palette, review remarks, and the processed images and audio the game loads
raw/              every ComfyUI output and its generation record
make/             generated make rules
src/render/       the first-person view
src/hud/          panels, automap, screens, stylesheet
src/input/        key bindings
scripts/          the toolbox above
tests/            generator, determinism, and rules tests
docs/             creative brief, decision log, asset review, final report
goals/            session goals, status, handoffs
workflows/        the seven ComfyUI API workflow files
dist/, out/       build output and screenshots (not in git)
```

## Credits

The typeface is VT323 by Peter Hull (SIL Open Font License), bundled
from the `@fontsource/vt323` package.
