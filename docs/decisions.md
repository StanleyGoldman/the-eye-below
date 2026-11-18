# Decision log

One dated line per significant creative or engineering decision and
why. A record, not a request for review.

## 2026-11-17 (session 1)

- **Original setting instead of NetHack's.** The game keeps the play
  model and every rule system `PROMPT.md` describes, but its title
  (The Eye Below), dungeon (the Cinderdeep), villain (Morvane), goal
  (the Unblinking Eye), named characters, level layouts, item labels,
  and all text are original. Why: the build must not reuse a
  specific existing game's name, characters, or levels. The title
  requested mid-session was declined for the same reason. Figures
  from myth (Medusa, an oracle, Excalibur, Mjollnir, valkyries,
  cockatrices) are used as myth.
- **Three releases.** Session 1 is the whole rules engine on
  code-drawn art; session 2 is generated images plus shops and NPCs;
  session 3 is animation, audio, the last treasure systems, review,
  and report. Why: each must be a complete game, and the split puts
  all code-heavy rules first, where tests can hold them.
- **ComfyUI untouched in session 1.** Why: features absent from a
  release are absent, and session 2 owns the whole pipeline. The
  permissions file was drafted for all three sessions regardless.
- **Raycast view with strip-drawn walls.** Each screen column casts
  one ray across the grid and draws one scaled texture strip. Why:
  it is the strip technique the brief asks for, and it lets steps
  and turns tween smoothly because the camera can sit between cells.
- **View depth.** The view shows at least 4 cells ahead and 1 to each
  side; cells further to the side that fall inside the view cone are
  also drawn, fading into darkness. Why: a hard cut at one cell to
  the side leaves black wedges in open rooms.
- **Game logic has no DOM access at all**, not only the generator.
  Why: the same code runs the tests, the level dump, the solvability
  sweep, and the scripted runs in Node.
- **The scripted victory run is a bot inside the game logic**, driven
  through the same actions as the keyboard, stepped synchronously by
  the Playwright script through a debug hook. Why: 25 real-time
  levels cannot be scripted key by key, and a fixed-step simulation
  is deterministic.
- **Node runs the TypeScript directly** (type stripping) for scripts
  and tests; esbuild bundles the game. Why: no second build step.
  Cost: only erasable TypeScript syntax (no enums, no parameter
  properties).
- **Playwright drives the installed Google Chrome** through
  `playwright-core`. Why: no browser download, which the network
  rule would not allow.
- **ffmpeg will come from the `@ffmpeg-installer/ffmpeg` npm
  package** in session 3. Why: ffmpeg and ffprobe are not installed
  on this machine and the registry is the only allowed source.
- **HUD in DOM, view in canvas.** Why: tooltips, lists, forms, and
  key rebinding are far less code in DOM; the canvas keeps the pixel
  look where it matters.
- **Modifiers are whole numbers 1 to 9, 5 is normal.** Why: one
  scale for the new-game screen, the run code, and the tests of
  every minimum and maximum.
- **Keys are consumed by their lock, and locks on the way to the
  stairs sit on corridors that are the only way through.** Why:
  solvable by construction, then verified by simulation.
- **Teleports land only in the area the player can currently walk
  to; arrivals from above or below by anything but stairs land in
  the up-stairs region.** Why: a teleport must never put the player
  behind a lock whose key is on the other side.
- **Boulders exist only on level 10.** Why: one place to guarantee
  they cannot wall the player in, with a reset lever.
- **Victory is taking the Unblinking Eye,** not carrying it back up.
  Why: 25 levels of backtracking in real time adds length, not play.
- **Stairs are used by walking onto them.** Why: one less key, and
  retreating up the stairs mid-fight is a tactic worth having.
- **A potion of hallucination was added (11 potions).** Why: the
  status list includes hallucination and it needs a source.
