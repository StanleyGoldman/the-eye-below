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
- **The unkillable debug option also blocks level drain.** Why:
  without it the bot, which stands and trades blows, was drained to
  level 1 by wraiths and vampires and could no longer hit anything.
  Death by attrition is still death.
- **The bot clears each level before descending, and reads items'
  true enchantment and curse state.** Why: rushing left it too weak
  for the last tier, and wielding unknown cursed weapons stalled it.
  It cheats at knowing, not at doing; every action goes through the
  same functions as the keyboard.
- **Acid and rust stop at -3.** Why: a weapon corroded without limit
  reached -16 in testing, which is a bug, not a hazard.
- **Ghoul paralysis is short (1 to 2 s, one time in four) and cannot
  be renewed while it lasts; vampire and troll regeneration were
  lowered.** Why: in real time the first numbers were a stun-lock and
  two stalemates.
- **No trapdoor opens onto a special level.** Why: special levels
  are entered by their stairs, so the Stoneyard and its lever are
  always met from the right side.
- **Item icons in the HUD are small canvases, not CSS backgrounds.**
  Why: tinted icons would otherwise have to be exported from a
  canvas, which fails once generated images are loaded from disk.
- **Characters have default names (Sigrun, Aldous, Finch).** Why:
  "Wizard the Wizard" on a tombstone reads as a mistake.
- **Damage shows as numbers rising in the view** as well as in the
  log and on the bars. Why: the brief asks for clear feedback for
  damage, and the log scrolls.

## 2026-11-17 (session 2)

- **Sessions 1 and 2 ran in one sitting.** `PROMPT.md` says one step
  per run. The goal set for the run ("run the details in prompt.md")
  required the whole build, and its stop check said so when session 1
  finished, so the run went on to step 2 instead of stopping.
- **Flux 2 for the reference monster, textures, fixtures, portraits,
  and the title; Z-Image for item icons and small interface pieces;
  Krea-2 for every other monster and character.** Why: compared on a
  newt and a brick wall, Flux 2 was grittier and closer to a DOS
  crawler, Z-Image cleaner but console-cute. At 32 pixels the
  difference does not survive, and Z-Image takes 2 s against 20 to
  28 s.
- **The newt is the style reference for all Krea-2 sprites,** two
  seeds each, the better one kept by eye with the reason recorded.
- **Qwen edit runs with the 4-step Lightning LoRA.** Why: the one
  test edit (newt, mouth open) held the character and took 24 s. It
  also moved the pose and added motion lines; session 3's edit
  prompts should forbid both.
- **One shared 64-colour palette for every image,** in
  `assets/prompts.json`, applied with a 4x4 ordered dither. Why: the
  brief asks for one shared palette and visible dithering.
- **Background removal trusts BiRefNet; the colour key is a tight
  clean-up only (tolerance 30, plus a rule for pink-purple fringe).**
  Why: the models paint "magenta" as crimson, and a looser key ate
  the fire drake.
- **Every sprite is fitted into a square box and stood on its bottom
  edge** (monsters 160, fixtures 128). Why: uniform sizes, feet on
  the floor, and frames of one animation will line up in session 3.
- **Frames that have no file yet are made at run time from their
  base image**: the attack pose is the idle sprite (the view already
  lunges it forward), the open door is the door squeezed aside, the
  thrown switch is the switch flipped, the second torch frame is the
  first mirrored. Why: otherwise a generated monster would turn into
  a code-drawn one mid-swing. Session 3 replaces these with edits.
- **"Image ids" in the asset checks means ASSETS entries that are
  not frames.** Why: frames are a separate manifest type, generated
  by a different workflow in session 3.
- **A shop's stock lives in the shopkeeper's ledger, not on the
  floor.** Why: the panel is how the brief says trade happens, and
  there is then nothing to shoplift and nothing to guard.
- **Old Wick's lamp shop sells oil lamps,** a new item: lit, the view
  reaches further in every direction. Why: a lighting shop needs
  something to sell that does something.
- **The shop room is chosen before locks, keys, and closets,** from
  its own random stream. Why: chosen last, half the levels had no
  free dead-end room left even at the highest shop frequency.
- **Peaceful characters stand still and block their cell,** and the
  solvability check treats them as walls. Rumor-mongers stand on
  interior cells; priests beside their altar but never on a cell
  that touches a way in.
- **Shopkeepers refuse invisible customers.** Why: a status changing
  what an action does, in the spirit of the rest.
- **ffmpeg and ffprobe come from the `@ffmpeg-installer` and
  `@ffprobe-installer` npm packages,** installed now rather than in
  session 3. Why: they were needed to confirm the two test audio
  jobs were the right length and not silent.
- **`raw/` is committed, rejected attempts included (about 220 MB).**
  Why: the brief asks for raw outputs and their records to be kept
  and committed so any asset can be reprocessed or compared.
