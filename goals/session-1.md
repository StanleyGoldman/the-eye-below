# Session 1: the playable core

Release name: v0.1 "Bare stone". A complete, winnable game with
code-drawn art and no sound.

## Scope

Sections of `PROMPT.md` this session covers:

- Autonomy: `docs/creative-brief.md`, `docs/decisions.md`.
- Sessions and goals: this plan, `make goal-check`, handoff, tag.
- Before you start: the permissions file.
- Toolchain, Repository layout: all of it.
- Makefile: `build`, `test`, `play`, `check`, `sweep`, `goal-check`,
  `clean`, `help`, with real dependencies and atomic writes.
- Helper scripts: `play`, `dump-level`, plus `sweep`, `determinism`,
  `audit`, `goal-check`.
- Build order step 1: the whole game on code-drawn placeholder art,
  every drawable routed through one ASSETS table keyed by id.
- View and movement, Time model, Character, Items and inventory,
  Rules that interact (all of it, including fountains, altars, and
  holy water), Seed and modifiers, Dungeon generation (all 25 levels
  and all five special levels), Automap, Controls, Finish (screens,
  save, restart).
- Treasure: gold piles, gold on monsters, and the score. The oracle
  on level 5 with its paid true hint, including the peaceful-NPC
  rules it needs (marked peaceful, confirmation before attacking,
  lasting cost for killing).
- Modernized interface: step and turn tweening, minimap and automap,
  hover tooltips, settings menu with key rebinding, autosave,
  feedback for cooldowns, damage, and locked doors.

Modifiers in this release (14): map size, monster count, monster
toughness, monster speed, loot amount, loot quality, cursed share,
blessed share, gold amount, puzzles per level, trap density, fountain
and altar frequency, resting safety, unidentified share.

## Out of scope (absent from this release, not stubbed)

- Everything that talks to ComfyUI: the `comfy`, `process`,
  `gen-rules`, and `sheet` scripts, `assets/manifest.json`, the asset
  make targets, generation records. Session 2.
- Shops, shopkeepers, priests, rumor-sharing NPCs, the dialogue
  panel, and the shop frequency, shop price, and NPC count
  modifiers. Session 2.
- Chests, vaults and the vault guard, gems, graves. Session 3.
- Audio of any kind, and the volume settings. Session 3.
- Generated animation frames (code-drawn idle and attack frames are
  in). Session 3.

## Acceptance checks

1. `make check` exits 0 (typecheck, tests, build, and the Playwright
   smoke run with no console errors).
2. `make test` reports at least 60 passing tests and 0 failing.
3. `make sweep` exits 0 and prints `unsolvable: 0`: all 25 levels
   are generated and pass the solvability simulation for 30 seeds at
   their seed-default modifiers, and for 3 seeds with each modifier
   in turn at its minimum and at its maximum.
4. `node scripts/determinism.ts` exits 0: two separate processes
   given the same seed and modifiers produce identical hashes for all
   25 levels, and a different seed produces different hashes.
5. `node scripts/play.ts --scenario victory` exits 0: from the title
   screen, a scripted run on a fixed seed (with the invulnerability
   debug option) reaches the victory screen.
6. `node scripts/play.ts --scenario death` exits 0: a scripted run
   without invulnerability reaches the death screen, restarts, and is
   back in the dungeon.
7. `node scripts/play.ts --scenario specials` exits 0 and saves five
   non-empty screenshots, `out/goal/special-05.png`, `-10`, `-15`,
   `-20`, `-25`, one from inside each special level, with no console
   errors.
8. `node scripts/audit.ts` exits 0: at least 12 weapons, 10 potions,
   8 scrolls, 6 wands, 10 spells, 20 regular monsters, 3 roles, and
   exactly 11 player statuses; every potion and every scroll has
   three distinct outcomes (blessed, uncursed, cursed) in the effect
   table and every scroll has a confused outcome; every asset id the
   game data refers to has a code-drawn entry in the ASSETS table.
9. No stubs: a search of `src/`, `scripts/`, and `index.html` for
   `TODO`, `FIXME`, `XXX`, `coming soon`, and `not implemented` finds
   nothing.
10. Offline: `index.html` loads `dist/game.js` with a classic script
    tag, and neither file contains an `http://` or `https://` URL, a
    `fetch(` call, `XMLHttpRequest`, or a dynamic `import(`.
11. Layout: the seven workflow files are in `workflows/`, and every
    tracked entry in the repo root is one named in the repository
    layout (plus `package.json`, `package-lock.json`,
    `tsconfig.json`, `.gitignore`).
12. Docs: `docs/creative-brief.md`, `docs/decisions.md`, and
    `goals/handoff-1.md` exist and are not empty; `README.md` has a
    "What is in this version" section and names every script in
    `scripts/`.
13. `git status --porcelain` prints nothing.
14. The tag `session-1` points at `HEAD`.

## Completion condition

Session 1 is complete when `make goal-check SESSION=1`, run in the
conversation after the final commit and tag, prints PASS for all 14
checks and a summary line of 14 of 14, and `git status` run right
after it shows a clean tree on the commit tagged `session-1`. The
checks above must be the ones committed in this file at the start of
the session, unchanged unless a change is recorded here with its
reason, and `goals/STATUS.md` and `goals/handoff-1.md` must be part
of that tagged commit.

## Changes to this file

None.
