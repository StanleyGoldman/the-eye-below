# Status

Current session: 1 (in progress)

| Session | Release | State |
|---|---|---|
| 1 | v0.1 "Bare stone": playable core, code-drawn art, silent | in progress |
| 2 | v0.2 "Lamplight": generated art, shops, NPCs | not started |
| 3 | v1.0 "Full dark": animation, audio, treasure, review, report | not started |

The checks are defined in `goals/session-N.md`. `make goal-check
SESSION=N` runs them.

## Session 1 checks

- [ ] 1. `make check` exits 0
- [ ] 2. at least 60 tests pass, 0 fail
- [ ] 3. `make sweep` prints `unsolvable: 0`
- [ ] 4. determinism script exits 0
- [ ] 5. scripted victory run reaches the victory screen
- [ ] 6. scripted death run reaches the death screen and restarts
- [ ] 7. five special-level screenshots saved, no console errors
- [ ] 8. content audit exits 0
- [ ] 9. no stubs
- [ ] 10. offline: no URLs or network calls in the page or bundle
- [ ] 11. repository layout
- [ ] 12. docs and README
- [ ] 13. `git status` clean
- [ ] 14. tag `session-1` at `HEAD`

## Session 2 checks

- [ ] 1. `make check` exits 0
- [ ] 2. at least 80 tests pass, 0 fail
- [ ] 3. `make sweep` prints `unsolvable: 0` (17 modifiers)
- [ ] 4. determinism script exits 0
- [ ] 5. scripted victory run
- [ ] 6. scripted death run and restart
- [ ] 7. five special-level screenshots
- [ ] 8. economy scenario
- [ ] 9. content audit with shops, NPCs, rumors
- [ ] 10. manifest valid, at least 90 image entries
- [ ] 11. image files, raws, and records: `missing: 0`
- [ ] 12. image sizes, palette, alpha
- [ ] 13. all seven workflows have a timed successful job
- [ ] 14. `make -q assets` exits 0
- [ ] 15. contact sheet built
- [ ] 16. assets scenario: zero failed loads, fallback pass works
- [ ] 17. no ComfyUI instance left running
- [ ] 18. no stubs
- [ ] 19. offline
- [ ] 20. repository layout
- [ ] 21. docs and README
- [ ] 22. `git status` clean
- [ ] 23. tag `session-2` at `HEAD`

## Session 3 checks

- [ ] 1. `make check` exits 0
- [ ] 2. at least 95 tests pass, 0 fail
- [ ] 3. `make sweep` prints `unsolvable: 0` (17 modifiers, vaults)
- [ ] 4. determinism script exits 0
- [ ] 5. scripted victory run
- [ ] 6. scripted death run and restart
- [ ] 7. five special-level screenshots
- [ ] 8. economy scenario
- [ ] 9. treasure scenario
- [ ] 10. audio scenario
- [ ] 11. manifest counts: 95 images, 28 frames, 10 music, 25 effects
- [ ] 12. all asset files, raws, and records: `missing: 0`
- [ ] 13. image sizes, palette, alpha, animation frame sizes
- [ ] 14. audio lengths, not silent, loudness records
- [ ] 15. generation records complete
- [ ] 16. `make -q assets` exits 0
- [ ] 17. contact sheets including animations
- [ ] 18. asset review lists every manifest id
- [ ] 19. final report has its five parts
- [ ] 20. no ComfyUI instance left running
- [ ] 21. no stubs
- [ ] 22. offline
- [ ] 23. repository layout
- [ ] 24. docs and README
- [ ] 25. `git status` clean
- [ ] 26. tag `session-3` at `HEAD`
