# Session 3: motion, sound, and treasure

Release name: v1.0 "Full dark". The finished game: animated, scored
and voiced, with the last treasure systems, a full asset review, and
the final report.

## Scope

Sections of `PROMPT.md` this session covers:

- Helper scripts: `process` for audio (trim, loudness) and for
  animation sets (union crop).
- Build order steps 2 and 3 for frames, music, and sound effects,
  and step 4, the review pass, across every asset.
- ComfyUI: the animation-frame batch (Qwen edit), cutouts of every
  frame, the music batch (ACE-Step), the sound-effect batch (Stable
  Audio).
- Asset list: Animation frames, Music, Sound effects, and the
  remaining images (chest closed and open, gem, grave, vault guard).
- Post-processing: no-jitter animation cropping, audio trimming and
  loudness, the length and silence checks.
- Audio playback: HTMLAudioElement music and effects, start after
  first input, music by tier and for the boss, separate volumes, the
  mute key, and the volume settings in the settings menu.
- Treasure, shops, and NPCs: chests and large boxes (locked,
  trapped, forced), vaults behind secret doors or switches, the vault
  guard, gems and worthless glass, graves with epitaphs including
  the last dead character's.
- Finish: the final report.

## Out of scope

Nothing in `PROMPT.md` is left for a later session. New features
beyond `PROMPT.md` are out of scope.

## Acceptance checks

1. `make check` exits 0 (typecheck, tests, build, and the Playwright
   smoke run with no console errors).
2. `make test` reports at least 95 passing tests and 0 failing.
3. `make sweep` exits 0 and prints `unsolvable: 0`, on the same seed
   plan as session 1, covering all 17 modifiers, with vaults present.
4. `node scripts/determinism.ts` exits 0.
5. `node scripts/play.ts --scenario victory` exits 0 and reaches the
   victory screen.
6. `node scripts/play.ts --scenario death` exits 0: death screen,
   restart, back in the dungeon.
7. `node scripts/play.ts --scenario specials` exits 0 and saves the
   five special-level screenshots with no console errors.
8. `node scripts/play.ts --scenario economy` exits 0 (as in session
   2).
9. `node scripts/play.ts --scenario treasure` exits 0: on a fixed
   seed the script opens a chest with a key, forces another, picks up
   a gem, meets the vault guard inside a vault, and after a saved
   death finds the dead character's grave in the next run.
10. `node scripts/play.ts --scenario audio` exits 0: no audio element
    plays before the first input; after it the track for the current
    tier is playing; the boss level switches to the boss track; the
    mute key silences both channels; volume settings survive a
    reload; and with audio loading disabled the run still completes.
11. `node scripts/audit-assets.ts --manifest` exits 0 with at least
    95 image, 28 frame, 10 music, and 25 sound-effect entries.
12. `node scripts/audit-assets.ts --files image frame music sfx`
    exits 0 and prints `missing: 0`: every entry has its processed
    file, raw file, and a record with one attempt marked kept, or is
    a recorded fallback after three rejected attempts; fallbacks are
    at most 10% of each type.
13. `node scripts/audit-assets.ts --pixels` exits 0: sizes, 64 colors
    or fewer, alpha where required, and all frames of one animation
    share one size.
14. `node scripts/audit-assets.ts --audio` exits 0: each music loop
    is 60 to 90 seconds, the death and victory pieces 5 to 30
    seconds, each sound effect 1 to 4 seconds, none is silent (mean
    volume above -45 dB), and each has its trim and loudness record.
15. `node scripts/audit-assets.ts --records` exits 0: every raw
    output has a record with all the fields `PROMPT.md` lists, and
    every job appears in `raw/generation-log.jsonl`.
16. `make -q assets` exits 0.
17. `make sheet` exits 0 and leaves contact sheets, including one per
    animation, in `out/sheets/`.
18. `docs/asset-review.md` lists every manifest id with a verdict
    (kept attempt number or fallback); its row count equals the
    manifest's entry count.
19. `docs/final-report.md` has the five parts `PROMPT.md` asks for:
    time per job for each workflow, assets generated, assets that
    fell back, audio files unverified by ear, and the make targets to
    rebuild and regenerate.
20. `node scripts/comfy.ts status` reports no ComfyUI instance left
    running by this session.
21. No stubs: a search of `src/`, `scripts/`, and `index.html` for
    `TODO`, `FIXME`, `XXX`, `coming soon`, and `not implemented` finds
    nothing.
22. Offline: `index.html` and `dist/game.js` contain no `http://` or
    `https://` URL, `fetch(` call, `XMLHttpRequest`, or dynamic
    `import(`.
23. Layout: every tracked entry in the repo root is one named in the
    repository layout (plus `package.json`, `package-lock.json`,
    `tsconfig.json`, `.gitignore`).
24. Docs: `goals/handoff-3.md` exists and is not empty; `README.md`
    has a current "What is in this version" section and names every
    script in `scripts/`.
25. `git status --porcelain` prints nothing.
26. The tag `session-3` points at `HEAD`.

## Completion condition

Session 3 is complete when `make goal-check SESSION=3`, run in the
conversation after the final commit and tag, prints PASS for all 26
checks and a summary line of 26 of 26, `git status` run right after
it shows a clean tree on the commit tagged `session-3`, and the
final report has been printed in the conversation with every audio
file listed as unverified by ear. The `session-1` and `session-2`
tags must still point at the commits they were created on.

## Changes to this file

None.
