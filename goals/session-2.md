# Session 2: generated art, shops, and company

Release name: v0.2 "Lamplight". The same game, now drawn by the
ComfyUI pipeline, with an economy and people to talk to.

## Scope

Sections of `PROMPT.md` this session covers:

- Helper scripts: `comfy` (all seven workflow commands plus `up`,
  `down`, `status`), `process` (images), `gen-rules`, `sheet`.
- Makefile: `base`, `styled`, `frames`, `cutouts`, `music`, `sfx`,
  `assets`, `sheet`, `comfy-up`, `comfy-down`, `clean-assets`, the
  generated `make/assets.mk`, and the guard against `-j`.
- Build order steps 2 and 3 for images, and step 4 for this
  session's images.
- ComfyUI: server handling, calling convention, the sprite pipeline
  (base, style reference, cutout), the Flux 2 versus Z-Image
  comparison. One confirmed test job for each of the three untested
  workflows (Qwen edit, ACE-Step, Stable Audio) so all seven are
  proven through the API.
- Generation records, Art direction, Post-processing (images).
- Asset list, Images: everything except the chest, gem, grave, and
  vault guard, which arrive with their features in session 3.
- View and movement: the layout skinned with the generated HUD
  pieces.
- Treasure, shops, and NPCs: shops of all five kinds with the buy
  and sell panel, priests and temple donations, the rumor-sharing
  NPCs, the rumor pool with true and false lines, the dialogue
  panel, hostile shopkeepers as a cost for killing peacefuls.
- Seed and modifiers: shop frequency, shop prices, NPC count (17
  modifiers in total).
- Automap: shop and NPC glyphs.

## Out of scope (absent from this release, not stubbed)

- Chests, vaults and the vault guard, gems, graves. Session 3.
- Audio playback and the music and sound-effect batches (only the
  two single test jobs run here). Session 3.
- The animation-frame batch (only the single Qwen test job runs
  here; the game keeps code-drawn attack frames where no generated
  frame exists). Session 3.

## Acceptance checks

1. `make check` exits 0 (typecheck, tests, build, and the Playwright
   smoke run with no console errors).
2. `make test` reports at least 80 passing tests and 0 failing.
3. `make sweep` exits 0 and prints `unsolvable: 0`, on the same seed
   plan as session 1 and now covering all 17 modifiers.
4. `node scripts/determinism.ts` exits 0.
5. `node scripts/play.ts --scenario victory` exits 0 and reaches the
   victory screen.
6. `node scripts/play.ts --scenario death` exits 0: death screen,
   restart, back in the dungeon.
7. `node scripts/play.ts --scenario specials` exits 0 and saves the
   five special-level screenshots with no console errors.
8. `node scripts/play.ts --scenario economy` exits 0: on a fixed
   seed the script enters a shop, buys an item and sells an item with
   gold changing by the quoted prices, confirms the world clock is
   paused while the panel is open, hears a rumor from an NPC, and
   buys protection from a priest.
9. `node scripts/audit.ts` exits 0 with session 1's counts plus: 5
   shop kinds, at least 5 kinds of peaceful NPC, and at least 40
   rumor lines of which at least 10 are marked true and 10 false.
10. `node scripts/audit-assets.ts --manifest` exits 0: every entry in
    `assets/manifest.json` has an id, type, workflow, prompt, seed,
    size, and transparency flag; there are at least 90 image entries;
    every image id in the ASSETS table has an entry.
11. `node scripts/audit-assets.ts --files image` exits 0 and prints
    `missing: 0`: every image entry has its processed file, its raw
    file, and a generation record with one attempt marked kept, or is
    listed as a fallback with three recorded rejected attempts;
    fallbacks are at most 10% of image entries.
12. `node scripts/audit-assets.ts --pixels` exits 0: every processed
    image is at its manifest size, uses 64 colors or fewer, and has
    an alpha channel where the manifest says transparent.
13. `node scripts/audit-assets.ts --workflows` exits 0:
    `raw/generation-log.jsonl` holds at least one successful, timed
    job for each of the seven workflows.
14. `make -q assets` exits 0: nothing is left to generate, and a
    second `make assets` runs no jobs.
15. `make sheet` exits 0 and leaves at least one contact sheet PNG in
    `out/sheets/`.
16. `node scripts/play.ts --scenario assets` exits 0: the game
    reports zero failed loads for the non-fallback images in the
    manifest, and a second pass with asset loading disabled still
    completes the smoke run on code-drawn art.
17. `node scripts/comfy.ts status` reports no ComfyUI instance left
    running by this session.
18. No stubs: a search of `src/`, `scripts/`, and `index.html` for
    `TODO`, `FIXME`, `XXX`, `coming soon`, and `not implemented` finds
    nothing.
19. Offline: `index.html` and `dist/game.js` contain no `http://` or
    `https://` URL, `fetch(` call, `XMLHttpRequest`, or dynamic
    `import(`.
20. Layout: every tracked entry in the repo root is one named in the
    repository layout (plus `package.json`, `package-lock.json`,
    `tsconfig.json`, `.gitignore`).
21. Docs: `goals/handoff-2.md` exists and is not empty; `README.md`
    has a current "What is in this version" section, a section on
    regenerating assets, and names every script in `scripts/`.
22. `git status --porcelain` prints nothing.
23. The tag `session-2` points at `HEAD`.

If ComfyUI cannot be started at all, checks 11 to 15 cannot pass as
written. In that case this file is amended with the cause from the
log, as the rules for changing a check require, and the release
ships on code-drawn art.

## Completion condition

Session 2 is complete when `make goal-check SESSION=2`, run in the
conversation after the final commit and tag, prints PASS for all 23
checks and a summary line of 23 of 23, and `git status` run right
after it shows a clean tree on the commit tagged `session-2`. The
time of the first job of each of the seven workflows must have been
reported in the conversation, and the `session-1` tag must still
point at the commit it was created on.

## Changes to this file

None.
