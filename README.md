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
| Esc | pause menu; also closes whatever is open |

Every key can be changed under Settings. Every button on screen has a
tooltip, as does every item, stat, and status.

A run is defined by its seed and its modifiers. The new-game screen
shows both, lets you change any modifier, and gives a short run code
(for example `EB1.candle.mc7tr2`) that reproduces the run exactly when
pasted into the same screen.

## What is in this version

Version 0.1, "Bare stone" (git tag `session-1`): the whole game on
code-drawn art, without sound.

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
- 20 regular monsters and 5 special ones, several with rules of their
  own (floating eye, cockatrice, acid blob, troll, stalker,
  leprechaun, wraith, Medusa).
- Fountains (drink, dip), altars (pray, test for curses), holy and
  unholy water, the oracle and its paid true answers, traps.
- Automap in ASCII, always-on minimap, message log, on-screen
  movement and action buttons, key rebinding, autosave and continue,
  tombstone and victory screens with score and run code.
- 14 run modifiers, a difficulty rating, run codes.

Not in this version (planned in `goals/`): generated art and the
ComfyUI pipeline, shops and other characters (session 2); animation
frames, music and sound, chests, vaults, gems, graves (session 3).

## Build, test, check

`make help` lists everything. The ones that matter:

| Target | Does |
|---|---|
| `make build` | bundles `src/` into `dist/game.js` (only when a source changed) |
| `make test` | generator, determinism, and rules tests |
| `make sweep` | generates 2,850 levels and checks each is solvable |
| `make play` | the browser smoke run; screenshots in `out/shots/smoke/` |
| `make check` | typecheck, tests, build, smoke run. Run before every commit |
| `make goal-check SESSION=1` | every acceptance check for a session, one PASS or FAIL line each |
| `make clean` | removes build output only |

The browser script drives the installed Google Chrome through
`playwright-core`; nothing is downloaded.

## Scripts

All in `scripts/`, run with `node`. Each prints what it did and exits
non-zero on failure; `--help` prints usage.

| Script | Does |
|---|---|
| `scripts/build.ts` | bundles the game with esbuild, writing atomically |
| `scripts/play.ts` | headless browser run. `--scenario smoke`, `victory`, `death`, `specials`, or `keys` with `--seed`, `--role`, `--mods id=n,...`, `--level n`, `--keys "KeyW,KeyQ,..."`, `--out dir`, `--god`, `--headed` |
| `scripts/dump-level.ts` | prints a generated level as ASCII with keys, doors, and switches marked: `--seed s --level n [--mods ...] [--monsters]`, or `--all` for a line per level |
| `scripts/sweep.ts` | the solvability sweep behind `make sweep` |
| `scripts/determinism.ts` | generates a seed in two separate processes and compares level hashes |
| `scripts/audit.ts` | counts the game's content and checks the effect table and the ASSETS table |
| `scripts/solve-boulders.ts` | solves the Stoneyard puzzle and prints the solution stored in `src/dungeon/special.ts`; run again if the template changes |
| `scripts/goal-check.ts` | runs a session's acceptance checks (`make goal-check`) |

## Debugging

Add `?debug=1` to the page address for a `window.__eye` object
(`info()`, `runBot(mode, gameMs)`, `auto(mode)`, `speed(n)`,
`vantage()`) and an "unkillable" checkbox on the new-game screen.
With `&start=1` the page skips the menus:

```
index.html?debug=1&start=1&seed=candle&role=wizard&level=15&god=1
```

## Regenerating assets

There is nothing to regenerate yet: every image in this version is
drawn in code, in `src/assets/`, and looked up by id through the
ASSETS table in `src/assets/table.ts`. Session 2 adds the ComfyUI
pipeline, `assets/manifest.json`, and the `make assets` targets, and
this section will say how to run them.

## Layout

```
index.html        entry point, loads dist/game.js
src/core/         seeded random numbers, modifiers, run codes
src/dungeon/      generator, special levels, solvability check (no DOM)
src/game/         state, rules, effect table, monsters, bot, saving (no DOM)
src/assets/       the ASSETS table and code-drawn art
src/render/       the first-person view
src/hud/          panels, automap, screens, stylesheet
src/input/        key bindings
scripts/          the toolbox above
tests/            generator, determinism, and rules tests
docs/             creative brief and decision log
goals/            session goals, status, handoffs
workflows/        the seven ComfyUI API workflow files (used from session 2)
dist/, out/       build output and screenshots (not in git)
```

## Credits

The typeface is VT323 by Peter Hull (SIL Open Font License), bundled
from the `@fontsource/vt323` package.
