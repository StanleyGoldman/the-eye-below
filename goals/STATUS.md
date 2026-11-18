# Status

All three sessions are complete. The build described in `PROMPT.md` is finished; there is no next session.

| Session | Release | State |
|---|---|---|
| 1 | v0.1 "Bare stone": playable core, code-drawn art, silent | complete, tag `session-1` |
| 2 | v0.2 "Lamplight": generated art, shops, NPCs | complete, tag `session-2` |
| 3 | v1.0 "Full dark": animation, audio, treasure, review, report | complete, tag `session-3` |

The checks are defined in `goals/session-N.md`. `make goal-check
SESSION=N` runs them.

## Session 1 checks

All 14 pass at the commit tagged `session-1` (2026-11-17). Checks 13
and 14 are made true by that commit and tag; the run of
`make goal-check SESSION=1` that shows all 14 is in the session's
conversation; `goals/handoff-1.md` has the output for checks 1 to 12.

- [x] 1. `make check` exits 0
- [x] 2. at least 60 tests pass, 0 fail (110 pass)
- [x] 3. `make sweep` prints `unsolvable: 0` (2,850 levels)
- [x] 4. determinism script exits 0
- [x] 5. scripted victory run reaches the victory screen
- [x] 6. scripted death run reaches the death screen and restarts
- [x] 7. five special-level screenshots saved, no console errors
- [x] 8. content audit exits 0
- [x] 9. no stubs
- [x] 10. offline: no URLs or network calls in the page or bundle
- [x] 11. repository layout
- [x] 12. docs and README
- [x] 13. `git status` clean
- [x] 14. tag `session-1` at `HEAD`

## Session 2 checks

All 23 pass at the commit tagged `session-2` (2026-11-17). Checks 22
and 23 are made true by that commit and tag; the run of
`make goal-check SESSION=2` that shows all 23 is in the session's
conversation.

- [x] 1. `make check` exits 0
- [x] 2. at least 80 tests pass, 0 fail (126 pass)
- [x] 3. `make sweep` prints `unsolvable: 0` (3,300 levels, 17 modifiers)
- [x] 4. determinism script exits 0
- [x] 5. scripted victory run
- [x] 6. scripted death run and restart
- [x] 7. five special-level screenshots
- [x] 8. economy scenario
- [x] 9. content audit with shops, NPCs, rumors
- [x] 10. manifest valid, at least 90 image entries (103)
- [x] 11. image files, raws, and records: `missing: 0`, no fallbacks
- [x] 12. image sizes, palette, alpha
- [x] 13. all seven workflows have a timed successful job
- [x] 14. `make -q assets` exits 0
- [x] 15. contact sheet built
- [x] 16. assets scenario: zero failed loads, fallback pass works
- [x] 17. no ComfyUI instance left running
- [x] 18. no stubs
- [x] 19. offline
- [x] 20. repository layout
- [x] 21. docs and README
- [x] 22. `git status` clean
- [x] 23. tag `session-2` at `HEAD`

## Session 3 checks

All 26 pass at the commit tagged `session-3` (2026-11-18). Checks 25
and 26 are made true by that commit and tag; the run of
`make goal-check SESSION=3` that shows all 26 is in the session's
conversation. Every audio file is unverified by ear: see
`docs/final-report.md`.

- [x] 1. `make check` exits 0
- [x] 2. at least 95 tests pass, 0 fail (140 pass)
- [x] 3. `make sweep` prints `unsolvable: 0` (3,300 levels, 17 modifiers, 259 vaults)
- [x] 4. determinism script exits 0
- [x] 5. scripted victory run
- [x] 6. scripted death run and restart
- [x] 7. five special-level screenshots
- [x] 8. economy scenario
- [x] 9. treasure scenario
- [x] 10. audio scenario
- [x] 11. manifest counts: 109 images, 30 frames, 10 music, 27 effects
- [x] 12. all asset files, raws, and records: `missing: 0`, no fallbacks
- [x] 13. image sizes, palette, alpha, animation frame sizes
- [x] 14. audio lengths, not silent, loudness records
- [x] 15. generation records complete (223 attempts, 349 jobs logged)
- [x] 16. `make -q assets` exits 0
- [x] 17. contact sheets including one per animation
- [x] 18. asset review lists every manifest id (176 rows)
- [x] 19. final report has its five parts
- [x] 20. no ComfyUI instance left running
- [x] 21. no stubs
- [x] 22. offline
- [x] 23. repository layout
- [x] 24. docs and README
- [x] 25. `git status` clean
- [x] 26. tag `session-3` at `HEAD`
