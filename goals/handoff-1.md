# Handoff from session 1

Written 2026-11-17. Release v0.1 "Bare stone", tag `session-1`.

## What was done

Everything in `goals/session-1.md`'s scope. In short: the complete
game on code-drawn art, silent, playable from title screen to
tombstone or victory and back.

- Plan for all three sessions in `goals/`; `make goal-check SESSION=1`.
- `.claude/settings.json`, approved by the user as proposed.
- `docs/creative-brief.md` and `docs/decisions.md`.
- Toolchain: TypeScript (strict, erasable syntax only, run directly
  by Node for scripts and tests), esbuild bundle to `dist/game.js`,
  Makefile, `playwright-core` driving the installed Google Chrome.
- Generator (`src/dungeon/`): sector layout with one-wide corridors
  that cannot touch, locks placed on the route with their openers in
  earlier regions, closets, bone keys across levels, five special
  levels from ASCII templates, solvability by simulation.
- Rules (`src/game/`): no DOM anywhere. State, effect table
  (`data/effects.ts`) and its interpreter, combat, monster behaviour,
  actions, world tick, bot, saving.
- View (`src/render/view.ts`): raycast walls drawn as strips, floor
  and ceiling by row, sprites clipped by column, tweened steps and
  turns.
- Interface (`src/hud/`, `src/input/`): DOM panels, ASCII automap and
  minimap, tooltips, prompts, key rebinding, all screens.
- 110 tests; sweep of 2,850 levels; determinism across processes;
  Playwright scenarios `smoke`, `victory`, `death`, `specials`,
  `keys`.

## What was deferred, and why

Nothing in session 1's scope was deferred. By plan, not by slip:

- ComfyUI was not started or contacted. Session 2 owns the pipeline.
- No audio code exists. Session 3.

## What the next session needs to know

**Setting.** The game is The Eye Below, with an original setting
(see the first entry in `docs/decisions.md`). It does not use
NetHack's or Eye of the Beholder's names, characters, or level
layouts, and later sessions must keep to that: prompts, file names,
and text included. The user asked mid-session for the title "Eye of
Nethack"; that was declined for the same reason and they were told.

**Art goes through ids.** `src/assets/table.ts` is the ASSETS table;
`src/game/data/assets.ts` lists every id the game refers to (125
today) and `scripts/audit.ts` checks the two agree. Sizes: textures
and world sprites 64x64, item icons 32x32, portraits 48x48, title
320x180. The manifest in session 2 should use these ids unchanged.

**Loading files over the code-drawn art.** `AssetStore.get(id)`
(`src/assets/store.ts`) returns a canvas. To load generated files,
keep that method and have it return the loaded image when one exists
and the code-drawn canvas when it does not or when loading fails.
Two traps:

- A canvas that has had a file:// image drawn on it is tainted.
  Drawing from it is fine; `toDataURL` throws. `AssetStore.url(id)`
  is only used for untinted CSS backgrounds (HUD frame, slot,
  portraits, title, compass) and must return the file's own path for
  file-backed art. Tinted and shaded variants are only ever drawn,
  never exported, so they are safe as they are.
- Item icons in the HUD are already small canvases, not CSS
  backgrounds, for this reason.

**Neutral, tintable images.** Door, key, potion, scroll, spellbook,
wand, ring, and amulet are tinted in code by multiplying. The
generated versions must be pale where the colour should show.

**Frames.** Monsters already have two ids each, `monster_<id>` and
`monster_<id>_attack`; doors have `door`, `door_half`, `door_open`;
switches `switch_off`, `switch_on`; torches `torch_1`, `torch_2`.
The view picks the frame; session 3 only has to supply images.

**Sound hooks.** Game events of kind `sound` (ids: `swing`, `hit`,
`hurt`, `door`, `switch`, `boulder`, `key`, `coins`, `pickup`,
`quaff`, `scroll`, `zap`, `spell`) and `step`, `bump`, `locked`,
`levelup`, `descend` are already emitted and drained in
`src/main.ts` (`drainEvents`). Session 3 plays them.

**Adding modifiers.** Each modifier takes its default from its own
stream, so adding shop frequency, shop prices, and NPC count in
session 2 does not change any existing seed's values. Add them to
`MODIFIERS` in `src/core/modifiers.ts` with a unique two-letter
code; the new-game screen, run codes, sweep, and tests pick them up.

**Adding acceptance checks.** `scripts/goal-check.ts` defines
session 1's checks in `SESSIONS[1]`. Add `SESSIONS[2]` and
`SESSIONS[3]` from the goal files; the helpers are there.

**Peaceful characters.** `MonsterType.peaceful` plus the confirm
prompt in `swing()` (`src/game/combat.ts`) is the whole mechanism.
The oracle is the only one so far. The penalty for killing one is
applied in `removeMonster` by the type's flag, so it still applies
after the creature has been provoked.

**Prompts pause the world.** `update()` returns early while
`state.prompt` is set. The shop panel in session 2 can rely on that.

**The bot.** `src/game/bot.ts` plays through the same actions as the
keyboard and reads the whole level. With the debug option it clears
levels and wins; without it, it rests when hurt and drinks known
healing potions. Three things it cannot do, which matter if a later
change stalls the victory run: it never uses scrolls or wands, never
retreats, and follows the stored Stoneyard solution rather than
solving it. If the Stoneyard template changes, run
`node scripts/solve-boulders.ts` and paste the new string.

**Debug option.** "Unkillable" also blocks level drain. Without that
the bot was drained to level 1 by wraiths and could no longer hit
anything; recorded in `docs/decisions.md`.

**Saves.** `SAVE_VERSION` is 1. A change to the shape of `GameState`
in session 2 should bump it, which makes old saves quietly not load.

## Known problems

- **Balance is untested by human hands.** Numbers were set by
  reasoning and by bot. For reference, over 30 seeds at seed-default
  modifiers the careful bot (rests, drinks healing, otherwise stands
  and fights) dies at a median depth of 7 as Valkyrie, 6 as Wizard,
  5 as Rogue, never getting past 13 (3 of the 90 runs were still
  alive when the three-hour budget ran out). A player who steps out of reach
  between blows should do much better; nobody has checked.
- Level 1 can still kill: kobolds and jackal packs account for most
  early bot deaths.
- The stairs are drawn as an upright sprite in the middle of the
  cell, like every other fixture. It reads, but it is not how stairs
  look. Generated art in session 2 is the place to fix it.
- Hallucination only changes how monsters are drawn and named in the
  view; the map still shows true letters.
- The view fades to black beyond about 4.5 cells; in large rooms the
  far wall is invisible until approached. That is the intended torch
  radius, and the light spell extends it, but it may feel short.
- `npm ci` (run by `make` when `package.json` changes) needs the npm
  registry.

## What I could not verify

- How the game feels in the hands: key repeat, step and turn speed,
  whether dodging a telegraphed blow is comfortable at 420 ms.
- Any browser other than Google Chrome 157 (headless). Firefox and
  Safari have not been opened.
- Performance on a slow machine. The view is several hundred canvas
  draws a frame.
- Readability of the 17 px VT323 text at small window sizes.

## The checks at the end

`make goal-check SESSION=1`, run just before the final commit,
passed checks 1 to 12:

```
PASS  1. make check exits 0 - check: all passed
PASS  2. at least 60 tests pass, 0 fail - 110 passed, 0 failed (at least 60 needed)
PASS  3. make sweep prints unsolvable: 0 - sweep: 2850 levels generated in 1.0 s, 0 fell back to a lock-free layout; unsolvable: 0
PASS  4. determinism across two processes - seed "candle", two processes: 25 of 25 levels identical; seed "candle-other": 25 of 25 levels differ from the first seed
PASS  5. scripted run reaches the victory screen - play: victory passed in 3.6 s, 7 screenshot(s) in out/shots/victory/
PASS  6. scripted run reaches the death screen and restarts - play: death passed in 2.1 s, 2 screenshot(s) in out/shots/death/
PASS  7. five special-level screenshots, no console errors - 5 of 5 screenshots saved; play: specials passed in 6.4 s, 15 screenshot(s) in out/goal/
PASS  8. content audit - audit: ok
PASS  9. no stubs - no stub markers in src/, scripts/, index.html
PASS 10. offline: no URLs or network calls - classic script tag; no URLs or network calls in index.html or the 405 kB bundle
PASS 11. repository layout - 7 workflow files in workflows/; 12 root entries, all in the layout
PASS 12. docs and README - brief, decisions, handoff present; README names all 8 scripts
```

Checks 13 (clean tree) and 14 (tag at HEAD) cannot pass until this
file is committed and the commit tagged, so they are shown by the
run made after tagging, in the session's conversation. To see all 14
again: check out `session-1` and run `make goal-check SESSION=1`.

The scripted victory run used seed `goal-1`, Valkyrie, with the
unkillable option: level 25 reached and the Eye taken after 88 game
minutes and 411 kills. The death run used run code
`EB1.goal1.mc9mt9`, Wizard.

## Changes to later goals

None. `goals/session-2.md` and `goals/session-3.md` stand as written
at the start of this session.
