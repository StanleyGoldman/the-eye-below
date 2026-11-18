# Build prompt: first-person dungeon crawler

Build a complete, playable first-person dungeon crawler in this
repository. It must run by opening `index.html` directly in a browser
(file://, no server, no network requests at runtime). You will write
the game in TypeScript, and generate all of its art, animation
frames, music, and sound through my local ComfyUI using the seven
API workflow files already in this repo.

## Concept

A modernized tribute to the Eye of the Beholder games, themed on
NetHack.

- Play model: the early-90s real-time grid crawlers on DOS, Eye of
  the Beholder and especially Dungeon Hack. One character, first
  person, procedurally generated dungeon, lock-and-key puzzles,
  real-time combat gated by cooldowns.
- Theme: NetHack. The dungeon is the Dungeons of Doom, the goal is to
  take the Amulet of Yendor from the Wizard of Yendor on level 25.
  Monsters, items, and tone come from NetHack: its bestiary,
  its dry humor in the message log, fountains and altars to interact
  with, and potions and scrolls that are unidentified until used,
  with their appearances shuffled per seed.
- NetHack's interacting rules are the point of the theme: things
  behave differently depending on state, and the player learns
  them. Implement these properly (see Rules that interact); do not
  attempt all of NetHack:
  - monsters that are more than stat blocks, e.g. hitting a
    floating eye in melee paralyzes you, a cockatrice is dangerous
    to touch
  - blessed, uncursed, and cursed versions of an item doing
    different things
  - status effects on the player changing what drinking, reading,
    and casting do
- Modernized means the interface, not the look. Keep the VGA-era
  pixel art, but add: smooth step and turn tweening, an always-on
  minimap plus the full automap, hover tooltips on items and stats,
  a settings menu (volume, key rebinding), autosave, and clear
  feedback for cooldowns, damage, and locked doors.
- Every run is defined by a seed and a set of modifiers derived from
  it (see Seed and modifiers).

## Autonomy

No human takes part in the creative or the engineering process.
Everything this file leaves open is yours to decide: the game's
title, tone, lore, monster roster, level layouts, balance, the look
of every asset, the architecture, libraries, data formats, and how
the work is split and ordered.

- Never ask me a creative or engineering question, and never wait
  for my approval of a design, an asset, or a piece of code. Decide,
  write down the decision, and continue.
- Where this file gives a number as "about" or a list as examples,
  treat it as guidance and settle the specifics yourself. Where it
  is specific, follow it.
- You are your own reviewer. "Approved" anywhere in this file means
  approved by you: look at the image, screenshot, or test output,
  judge it against this file, and regenerate or fix it if it falls
  short.
- In session 1, before building, write `docs/creative-brief.md`:
  the title, premise, tone, palette, the full monster and NPC
  roster, the item lists, and the style rules you will hold the art
  to. Later sessions follow it and may amend it with a reason.
- Keep `docs/decisions.md`: one dated line per significant creative
  or engineering decision and why. This is a record, not a request
  for review.
- If something is blocked (a tool is missing, ComfyUI will not
  start, a workflow keeps failing), work around it within this
  file's rules, fall back as described, record it in the handoff,
  and keep going. Do not stop to ask.
- The only thing you ask me for is the permissions file at the very
  start of session 1 (next section but one). That is a security
  boundary, not a design choice.

## Sessions and goals

This build happens over three Claude Code sessions. I start every
one of them the same way:

    /goal run the next step in the prompt

"The prompt" is this file, and a step is one session. I will not
write a more specific condition. The first run chooses the
completion condition for itself and for each later session, and
saves them in the goal files. The evaluator model that decides whether the
goal is met only sees the conversation. It does not run commands or
read files.

Working out the next step, at the start of every session:

- If `goals/STATUS.md` does not exist, this is session 1.
- Otherwise the next step is the first session that
  `goals/STATUS.md` does not mark complete. If all three are
  complete, say so and stop; do not invent more work.
- Before doing any work, state in the conversation which step this
  is and print its completion condition and acceptance checks from
  the goal file, word for word, so the evaluator knows what "the
  next step" means and what finishing it looks like. In session 1,
  do this as soon as the goal files are committed.

Keeping the evaluator accurate:

- End every turn with one status line: the step number, how many
  acceptance checks pass out of the total, and what is next. This
  stops the goal being judged met while work remains.
- The step is complete only when its saved completion condition is
  shown to hold in the conversation. Then say plainly that step n,
  the next step in the prompt, is complete.
- Do one step per run. When it is complete, stop. Do not start the
  following session's work, even if there is time left.

Session 1 plans all three sessions before building anything:

1. Read this whole file. Decide what each of the three sessions
   will accomplish, so that the full build described here is
   covered and nothing is left unassigned.
2. Write the plan to `goals/` and commit it before starting any
   other work:
   - `goals/session-1.md`, `session-2.md`, `session-3.md`: for each,
     the scope (which sections of this file it covers), what is
     explicitly out of scope, a numbered list of acceptance checks,
     and the completion condition you have chosen for that session.
   - `goals/STATUS.md`: which session is current, and a checklist of
     every acceptance check with its state.
3. Then carry out session 1's goal.

Rules for the plan:

- Every session delivers a playable game, not a stage of
  construction. At the end of each one, a person can open
  `index.html` and play a whole run: title screen, new game with a
  seed, explore, fight, use items, descend, and reach either the
  death screen or the victory screen, then start again. Nothing on
  screen leads to a dead end, a stub, or a "coming soon".
- Plan the three sessions as three releases of the same game, each
  complete at its own scope and each better than the last, instead
  of as layers that only work once all three are done. Session 1's
  game may be smaller and plainer (fewer systems, placeholder art
  where generation has not happened yet), but it must be winnable
  and fun to poke at on its own. Features that are not in a release
  are absent from it, not half-present.
- Every session's acceptance checks include: `make check` passes; a
  scripted run on a fixed seed reaches the victory screen (a debug
  option that makes the player unkillable is fine for this check
  only); a second scripted run reaches the death screen and
  restarts; `git status` is clean. No session ends on half-finished
  work.
- Tag the final commit of each session (`session-1`, `session-2`,
  `session-3`) and keep the README's "what is in this version"
  section current, so any of the three can be checked out and
  played.
- You choose the split, but do not leave all asset generation to
  the last session. Get the ComfyUI pipeline proven end to end, and
  tier 1 art and the HUD in the game, by the end of session 2 at
  the latest, so the last session is not the first time art meets
  the renderer.
- Balance the sessions by effort, not by section count.
- Each acceptance check is something a command can show: a make
  target exiting 0, a test count, a file count, a manifest with no
  missing assets, a screenshot saved for each special level. Avoid
  checks that depend on taste.
- Add a `make goal-check SESSION=n` target that runs every
  acceptance check for that session and prints one PASS or FAIL
  line per check, then a final summary line.
- Write each completion condition as one short paragraph that the
  conversation alone can prove: one measurable end state, how it is
  shown, and what must not change on the way. It should come down
  to `make goal-check SESSION=n` printing PASS for every check and
  `git status` being clean, plus anything specific to that session,
  without weakening any check.
- A later session may not rewrite its own completion condition. If
  an earlier session's handoff changes a later condition, it says
  why and commits the change.
- A check may only be changed for a stated reason, recorded in the
  goal file and committed. Never edit a check to make it pass.

At the end of every session:

- Run `make goal-check` and `git status` so the results are in the
  conversation.
- Write `goals/handoff-n.md`: what was done, what was deferred and
  why, decisions the next session needs to know, known problems,
  and anything you could not verify yourself (such as how the
  audio sounds).
- Update `goals/STATUS.md`. If what you learned means a later
  session's goal should change, edit that goal file, say why in the
  handoff, and commit.

At the start of sessions 2 and 3: read this file, `goals/STATUS.md`,
the current session's goal file, and every earlier handoff before
doing anything else. The earlier conversations are gone; these files
are the only memory.

The sections below describe what to build and in what dependency
order. They do not decide which session does what; the goal files
do.

## Before you start: permissions

This build runs for a long time and should not stall on approval
prompts. In session 1, after committing the goal files and before
writing any code:

1. Read this whole file and work out which commands the build will
   need.
2. Draft a `.claude/settings.json` for this repo that pre-allows
   exactly those, and nothing broader. Expect roughly: `make`,
   `npm`, `npx`, `node`, `git` (local operations only, no push),
   `ffmpeg` and `ffprobe`, `curl` to `http://127.0.0.1:8188` only,
   `~/ai/comfyui.sh`, and stopping the ComfyUI process this session
   started. No blanket shell access, no network beyond the package
   registry and local ComfyUI, nothing outside this repo.
3. Show me the proposed file and a one-line reason for each entry,
   and ask me to approve it. Do not write it or rely on it until I
   say yes. If I change it, use my version.
4. This is the one time you ask me for anything. If you later need
   a command that is not allowed, do not ask and do not try to get
   around the restriction: find another way with what is allowed,
   or record it as blocked in the handoff and move on.

## Toolchain

- TypeScript in `src/`, split into modules (generator, game state,
  renderer, HUD, audio, input, assets). Strict mode on.
- Bundle with esbuild into one classic (IIFE) script,
  `dist/game.js`, loaded by `index.html`. ES modules do not load
  over file://, so the bundle is required.
- A Makefile at the repo root is the single entry point for
  everything that produces files (see Makefile).
- Keep the dungeon generator free of DOM access so it runs in Node.
- Test where it pays, and do not lean on tests as proof the game is
  good. Test the things that are pure logic and expensive to get
  wrong: generator solvability (many seeds, every modifier at its
  minimum and maximum, all five special levels), determinism (same
  seed and modifiers give an identical dungeon twice), and the core
  rules (to-hit, damage, item effects, curses, identification). No
  coverage targets, no unit tests for rendering or UI, no tests
  written only to have tests. Judge feel and visuals by playing.
- Playwright: one smoke script, not a test suite. It opens the built
  game headlessly, starts a run, walks, fights, opens a door, takes
  screenshots, and fails on any console error. Give it a way to
  start on any level so the special levels can be checked. Look at
  the screenshots yourself and fix what looks wrong.
- Commit to git often: after each working unit (a system, a script,
  a special level, a batch of assets), not only at the end of a
  build stage. Small commits with plain messages that say what
  changed. Never commit a broken build.
- Create `.gitignore` in the first commit and cover the obvious:
  `node_modules/`, `dist/`, `out/`, Playwright reports and caches,
  logs, editor and OS files (`.vscode/`, `.DS_Store`), and any
  `.env`.

## Repository layout

Keep the repo organized from the first commit. Use this layout, and
if you need something it does not cover, add a clearly named folder
instead of dropping files in the root.

```
index.html        entry point, loads dist/game.js
src/              game TypeScript, one folder per system
                  (dungeon/, game/, render/, hud/, audio/, input/)
assets/           processed files the game loads
  manifest.json
  images/  frames/  music/  sfx/
raw/              unprocessed ComfyUI outputs, same subfolders,
                  each with its generation record, kept so
                  post-processing can be re-run without regenerating
.claude/          settings.json, once I have approved it
workflows/        the seven ComfyUI API JSON files
Makefile          entry point for everything that generates files
make/             generated make fragments
scripts/          helper scripts
tests/            generator and determinism tests
docs/             creative brief and decision log
goals/            session goals, status, and handoffs
dist/             build output (gitignored)
out/              screenshots and contact sheets (gitignored)
README.md         how to build, test, play, and regenerate assets
PROMPT.md         this file
```

- The seven workflow JSON files are currently in the repo root. Move
  them into `workflows/` with `git mv` as the first step.
- Name asset files by their manifest id (`images/monster_newt.png`,
  `frames/monster_newt_attack.png`, `sfx/door_open.mp3`).
- Nothing generated or temporary in the root. Keep `.gitignore`
  current, and tidy the tree before each commit.

## Makefile

Use make for everything that generates files, so each output is
rebuilt only when it is missing or its inputs changed. The scripts
in `scripts/` do the work; the Makefile decides what needs doing.

- Every generated file is a make target with real dependencies:
  `dist/game.js` on the sources; each raw asset on its manifest
  entry and workflow; each cutout on its raw image; each processed
  asset on its raw or cutout file and the post-processing script;
  contact sheets on the processed images.
- Generate the per-asset rules from `assets/manifest.json` into an
  included fragment (e.g. `make/assets.mk`) instead of writing them
  by hand, and regenerate the fragment when the manifest changes.
- Group asset targets by workflow (`make base`, `make styled`,
  `make frames`, `make cutouts`, `make music`, `make sfx`), with
  `make assets` running the groups in that order. ComfyUI jobs must
  not run in parallel, so guard those targets against `-j`.
- Other targets: `build`, `test`, `play`, `check`, `sheet`,
  `comfy-up`, `comfy-down`, `clean` (build output only), and
  `clean-assets` (processed files only; never delete `raw/` without
  being asked). `make help` lists them.
- Write outputs atomically (to a temporary name, then rename) so a
  failed or interrupted job never leaves a half-written target that
  make treats as done.

## Helper scripts

Before building the game, write yourself a small toolbox in
`scripts/` and use it for everything repetitive, instead of
hand-writing one-off commands. Add to it whenever you catch yourself
doing the same thing twice. Each script takes arguments, prints what
it did, exits non-zero on failure, and is listed in the README. At
minimum:

- `comfy`: one command per workflow (image, fast image, style
  image, edit, cutout, music, sfx) that takes a prompt, seed, size
  or duration, and output path, and handles submit, polling,
  download, input-image upload, and the model-name substitution
  described under ComfyUI. It writes the generation record for
  every job (see Generation records). Also `comfy up`, `comfy down`, and
  `comfy status` for the server, where `down` only stops an
  instance this session started.
- `process`: post-processes one raw or cutout file into its final
  asset (crop, downscale, palette, or audio trim and normalize).
- `gen-rules`: writes the make fragment from the manifest.
- `sheet`: builds a contact sheet of all generated images (and each
  animation's frames side by side) so you can review the whole set
  in one look.
- `play`: the Playwright run, with options for seed, modifiers, and
  a scripted sequence of inputs, saving screenshots to a folder.
- `dump-level`: prints a generated level as ASCII for a given seed
  and modifiers, with keys, doors, and switches marked, for
  debugging the generator without the renderer.
- `make check` runs typecheck, tests, build, and the Playwright run
  in one command. Run it before every commit.

## Build order

This is dependency order, to be mapped onto the three sessions.

1. Game with code-drawn placeholder art and no audio, everything
   routed through one ASSETS table keyed by id. Fully playable, tests
   and Playwright passing. Commit.
2. Write `assets/manifest.json`: every asset id, its type (image,
   frame, music, sfx), prompt, target size or duration, and whether
   it needs transparency. Commit.
3. Run `make assets` to generate and post-process everything (Node
   scripts, e.g. with sharp), wire it in. Commit.
4. Review pass: look at every image, re-run Playwright, regenerate
   failures. Commit.

Any asset that is missing or fails to load falls back to its
code-drawn version (or silence, for audio). The game must never break
on a missing file.

## ComfyUI

All art and audio comes from my local ComfyUI (v0.45.0) through the
seven API workflow exports in `workflows/`. The model files for all
seven are installed and every workflow has a save node.

### Starting and stopping the server

ComfyUI is installed at `~/ai/ComfyUI` and is not running by default.
This session manages its own instance.

- Check first whether one is already up:
  `curl -sf http://127.0.0.1:8188/system_stats > /dev/null && echo up`
  If it is, use it. Do not start a second one; the port is taken.
- Otherwise start it with the launcher, which binds to
  127.0.0.1:8188 only. It runs in the foreground, so start it
  detached:
  `nohup ~/ai/comfyui.sh > out/comfyui.log 2>&1 &`
  Do not run it as a tracked background task: while one is running,
  `/goal` skips its end-of-turn evaluation.
- Wait until `/system_stats` answers before submitting jobs
  (normally 10-20 s; poll once a second for up to 60 s). If it does
  not come up, read the log for "Traceback", record the cause in
  the handoff, and continue with fallbacks. Do not try
  to fix the ComfyUI install.
- Startup warnings about `matrix-nio` and a missing
  `OpenGL_accelerate` module are harmless.
- If the server dies mid-batch (connection refused), restart it the
  same way and re-run `make assets`; it resumes where it stopped.
- When all generation is finished, stop the instance this session
  started, to free the GPU. Never stop one this session did not
  start.
- Do not run other GPU-heavy programs during generation. The 24 GB
  of graphics memory is shared.

### Calling it

- For every workflow: load the JSON, change the inputs listed below,
  and submit with `POST /prompt`, body `{"prompt": <workflow>}`.
  Poll `GET /history/<prompt_id>` until the id appears, read the
  output entry from the save node, and download it with
  `GET /view?filename=..&subfolder=..&type=output`. Always download
  through `/view`; do not read ComfyUI's output folder directly.
- Workflows that take an input image: upload it first with
  `POST /upload/image` (multipart, field `image`) and use the
  filename the server returns.
- Several exports have a fixed seed (some are 0). Set a different
  seed for every asset and record it in the manifest.
- Jobs run one at a time, and switching workflows reloads models.
  Batch by workflow, in this order: all base images, all
  style-reference images, all edit frames, all cutouts, then music,
  then sound effects.
- Time the first job of each workflow and report it. At most 2
  regenerations per asset.
- Generation must be re-runnable and skip assets that exist; make
  provides this as long as targets are written atomically.
- Tested end to end through the API: Flux 2, Z-Image, BiRefNet, and
  Krea-2. Not yet tested: Qwen edit, ACE-Step, and Stable Audio. For
  those three, run one job first and confirm the output before
  batching. If `/prompt` returns `value_not_in_list`, the error
  lists the installed names; substitute and retry.

### Sprite pipeline

1. Base sprite on a magenta background: Flux 2 (turbo) or Z-Image.
   Once the first monster is approved, generate the other monsters
   with Krea-2 using that sprite as the style reference.
2. Extra animation frames: Qwen edit on the base sprite.
3. Cutout: BiRefNet on every base sprite and every frame.
4. Post-process as described under Post-processing.

Compare Flux 2 and Z-Image on the first few assets and choose per
asset type: Flux 2 where quality matters, Z-Image for textures and
anything where speed matters more.

### Images: `image_flux2_text_to_image.json`

- `"98:6".inputs.text`: prompt
- `"98:25".inputs.noise_seed`: seed
- `"98:47"` and `"98:48"`: width and height, keep both in sync
- `"9".inputs.filename_prefix`: e.g. `crawler/<asset_id>`
- The export names three model files that are not installed. Set
  these up front:
  - `"98:10".inputs.vae_name`: `flux2-vae.safetensors`
  - `"98:38".inputs.clip_name`:
    `mistral_3_small_flux2_fp8.safetensors`
  - `"98:101".inputs.lora_name`: `Flux2TurboComfyv2.safetensors`
- `"98:104".inputs.value`: true enables turbo, 8 steps instead of
  20. Measured here: about 26 s per 1024x1024 image with turbo
  (about 47 s for the first job while the model loads), about a
  minute at 20 steps. Use turbo, and confirm the first sprite looks
  right before batching.

### Fast images and textures: `image_z_image_turbo.json`

Z-Image Turbo, 8 steps. About 6 s per 1024x1024 image warm, 14 s
cold. Tested with the sprite style: it gave a clean, centered
pixel-art sprite on magenta.

- `"57:27".inputs.text`: prompt
- `"57:3".inputs.seed`: seed
- `"57:13".inputs.width` and `height`: size
- `"9".inputs.filename_prefix`: output name
- There is no usable negative prompt (CFG is 1). Put everything in
  the positive prompt.

### Style-matched images: `image_krea2_turbo_int8_image_style_reference.json`

Krea-2 Turbo with a style-reference LoRA: a new subject in the style
of one reference image. 8 steps, 1 megapixel, about 14 s warm.

- `"69".inputs.image`: the uploaded style reference
- `"30:19".inputs.value`: the subject prompt
- `"30:24".inputs.value`: false uses the prompt as written; true
  expands it first. Leave it false.
- `"30:63".inputs.noise_seed`: seed
- `"71".inputs.aspect_ratio` and `megapixels`: output size
- `"29".inputs.filename_prefix`: output name
- How closely the style matches varies by seed: in testing one seed
  was close and another came out smoother and less pixelated.
  Generate 2 seeds per asset and keep the better one (this counts
  toward the regeneration limit).

### Animation frames: `image_qwen_image_edit_2511.json`

These games used 2-3 frame animations. Derive each sprite's other
frames by editing its base image, so the character stays the same.

- `"41".inputs.image`: the uploaded base image
- The workflow also wires a second reference image (node `"83"`,
  `image2` on nodes `"170:149"` and `"170:151"`). For single-image
  edits, remove both `image2` inputs and node `"83"`.
- `"170:151".inputs.prompt`: the edit instruction, e.g. "Same
  skeleton, same size and position, sword arm raised mid-swing. Keep
  the flat magenta background unchanged."
- `"170:169".inputs.seed`: seed
- `"170:168".inputs.value`: false is 40 steps (slow); true is the
  4-step Lightning LoRA, roughly 10x faster. Test true on one sprite
  first and use it if the result holds up.
- `"9".inputs.filename_prefix`: output name

### Background removal: `utility_birefnet_remove_background.json`

BiRefNet, about 1 s per image. Output is an RGBA PNG with a real
alpha channel. In testing it gave a clean cutout with no magenta
fringe and removed a faint ground shadow as well.

- `"17".inputs.image`: the uploaded sprite
- `"18".inputs.filename_prefix`: output name

### Music: `audio_ace_step1_5_xl_turbo.json`

- `"94".inputs.tags`: style description
- `"94".inputs.lyrics`: set the whole field to `[Instrumental]`
  (alternative: `[inst]`). You cannot hear the result, so rely on
  this setting.
- `"94".inputs.bpm`, `keyscale`, `timesignature`, `duration`
- `"94".inputs.generate_audio_codes`: leave true
- `"98".inputs.seconds`: keep equal to `"94".inputs.duration`
- `"109".inputs.value`: seed (node 94 reads it from here)
- `"111".inputs.filename_prefix`: output name (saves mp3)

### Sound effects: `audio_stable_audio_3_medium.json`

- `"52:31".inputs.value`: short description of the sound
- `"52:36".inputs.value`: duration in seconds
- `"52:43".inputs`: category; set `choice` to `"SFX"` and `index` to
  `2`
- `"52:35".inputs.value`: true lets the workflow expand the
  description itself; leave it on
- `"52:3".inputs.seed`: seed
- `"57".inputs.filename_prefix`: output name (saves mp3)

## Generation records

Save the prompt and settings behind every piece of generated media,
so any asset can be reproduced, compared, or regenerated later.

- For every ComfyUI job, write a JSON record next to the raw output
  (`raw/images/monster_newt.json` beside `monster_newt.png`)
  containing: the asset id, the workflow file name, the full
  workflow JSON exactly as submitted, and, pulled out for easy
  reading, the prompt text, seed, model and LoRA names, steps, size
  or duration, any input or reference image used, the ComfyUI
  prompt id, the output filename, start time, and how long it took.
- Keep a record for every attempt, including rejected ones, numbered
  per asset, with a short note on why an attempt was rejected. Mark
  which attempt was kept.
- Record post-processing too: crop box, target size, palette, and
  for audio the trim and loudness settings.
- Keep the shared STYLE string and any other prompt fragments in one
  versioned file (e.g. `assets/prompts.json`) that the manifest
  references, so the exact wording is saved in one place.
- Append one line per job to `raw/generation-log.jsonl` as a running
  history across the whole build.
- Write records in the same step that saves the output, and commit
  them with the assets. An asset without a record is not done.

## Art direction

- Define one STYLE string and append it to every image prompt so the
  set matches: early-1990s VGA DOS dungeon crawler, 256-color
  palette, visible dithering, chunky hand-pixelled shading, torchlit,
  gritty and muted, not cute, not 16-bit console.
- Sprites (monsters, items, door, switch, stairs): single subject,
  front-facing, centered, full body, "plain flat solid magenta
  background, no floor, no shadow, no text, no border".
- Textures (walls, floor, ceiling): flat, straight-on, evenly lit,
  edge to edge, no perspective, no objects.
- HUD pieces: stone or iron panel frame, inventory slot, button
  faces, compass, hand slots, class portraits. Text is always
  rendered in code, never baked into images.

## Post-processing

- Transparency for sprites comes from the BiRefNet cutout. The
  magenta comes out approximate, not exact, so keep a color-distance
  key (with a tolerance, flood-filling from the image edges) only as
  a fallback or cleanup pass.
- Frames of one animation must not jitter: crop all of them with the
  same box (the union of their bounding boxes), then scale together.
- Downscale with nearest-neighbor to the manifest size (monsters
  about 160px tall, items 32px, textures 64 or 128px) and quantize to
  a shared palette of 64 colors or fewer.
- Audio: trim leading and trailing silence and normalize loudness
  (ffmpeg if available). Check each file is the expected length and
  not silent. You cannot hear the audio, so list every audio file in
  the final report as unverified by ear.
- Do all of this at build time. The game must not read pixel data
  from images at runtime (file:// canvases are tainted).

## Asset list (minimum)

Images
- 5 wall texture sets, one per dungeon tier, each with a floor and
  ceiling
- Door (one neutral image, tinted in code per key color), wall
  switch, pressure plate, stairs down, wall torch
- About 20 monsters from the NetHack bestiary, four per tier, from
  early (newt, jackal) to late, including the ones with special
  rules, plus the Oracle, Medusa, and the Wizard of Yendor
- Fountain, altar, boulder, drawbridge, chest (closed and open),
  gold pile, gem (one neutral image, tinted in code), grave
- Peaceful NPCs: shopkeeper, priest, vault guard, and two or three
  others, drawn so they read as non-hostile at a glance
- Shop buy and sell panel and dialogue panel as HUD pieces
- Items: one icon per weapon and armor type; key, potion, scroll,
  spellbook, wand, ring, and amulet as one neutral image each,
  tinted in code for colors and shuffled appearances; gold; the
  Amulet of Yendor
- 3 class portraits
- HUD frame, slot, buttons, compass, title screen background

Animation frames (edited from the base images)
- Each monster and boss: idle and attack (show hits with a code
  flash, not a third frame)
- Wall switch: off and on. Door: closed, half open, open
- Wall torch: 2 flicker frames

Music (instrumental, loopable, 60-90 seconds each)
- Title theme, one exploration track per dungeon tier, a calm shop
  and temple theme, boss theme,
  short death and victory pieces

Sound effects (1-4 seconds each)
- Footstep, bump into wall, weapon swing, hit landed, player hurt,
  one growl per monster family (about 6), door open, locked door
  rattle, key pickup, item pickup, switch click, boulder push,
  potion quaff, scroll read, wand zap, spell cast, level up, stairs,
  coins picked up, chest open, shop door bell, purchase

This is a large set (roughly 95 images, 30 edits, 10 music tracks,
25 effects). Generate tier 1 and the HUD first and get them into the
game before batching the rest.

## View and movement

- First-person view on a square grid. One cell per step, 90-degree
  turns, no free look.
- Render to a canvas, 4 cells of depth and 1 cell to each side, with
  distance darkening. Front-facing walls are scaled texture draws;
  side walls are drawn by slicing the texture into vertical strips
  and scaling each strip to fake perspective. Image smoothing off.
- Doors, switches, stairs, floor items, and monsters appear in the
  view at the correct depth and scale, using their animation frames.
- Layout: viewport on the left, character panel (portrait, HP,
  stats, equipped hands, inventory grid) on the right, scrolling
  message log below, all skinned with the generated HUD pieces.

## Time model (the heart of the feel, get it right)

- The world runs on a real-time clock. Monsters move and attack on
  their own per-type timers whether or not the player acts.
- The player is not turn-locked but is rate-limited: a short delay
  between steps, and an attack cooldown per weapon after each swing
  (shown as a greyed-out hand until ready).
- Stepping out of a monster's reach between its attacks should be a
  viable tactic.

## Character

- One character. Choose from 3 NetHack roles at the start
  (Valkyrie, Wizard, Rogue) that play differently, each with
  NetHack's starting kit for that role. Tabletop-style d20 to-hit
  against armor class, dice damage, XP and levels.
- Spells work as in NetHack: learned by reading spellbooks, cast
  from a spell list, each costing power (Pw). Any role can learn
  them; the Wizard starts with force bolt and has the most Pw.
- Resting restores HP and Pw over time, advances the clock, and is
  interrupted if a monster comes into view. No resting with a
  monster adjacent.

## Items and inventory

Draw the item set from NetHack first, and from Eye of the Beholder
and Dungeon Hack where they add something. Keep each list to what
you can implement fully.

- Inventory is NetHack's: every item gets a letter (a-z, A-Z),
  grouped by class under NetHack's class symbols (`)` weapons, `[`
  armor, `!` potions, `?` scrolls, `+` spellbooks, `/` wands, `=`
  rings, `"` amulets, `$` gold). Identical items stack. Present it
  as a modern panel: click or press the letter, then pick an action
  (wield, wear, take off, quaff, read, zap, throw, drop).
- Items can be blessed, uncursed, or cursed, and weapons and armor
  carry an enchantment (+1, -2). Cursed gear cannot be removed until
  the curse is lifted. Unidentified items show only their shuffled
  appearance ("a murky potion", "a scroll labeled ZELGO MER") until
  used or identified.
- Weapons (about 12): dagger (throwable), short sword, long sword,
  two-handed sword, mace, war hammer, axe, spear, quarterstaff, bow
  and arrows, plus one or two artifacts such as Excalibur and
  Mjollnir. Wielded items occupy the two hand slots in the HUD.
- Armor: body armor, helmet, shield, boots, cloak, at a few grades.
- Potions (about 10): healing, extra healing, gain level, speed,
  see invisible, levitation, sleeping, blindness, confusion, water
  (holy water lifts curses).
- Scrolls (about 8): identify, enchant weapon, enchant armor, remove
  curse, magic mapping, teleportation, fire, scare monster.
- Wands (about 6): striking, magic missile, sleep, fire, cold,
  lightning, with limited charges.
- Spells (about 10): force bolt, magic missile, sleep, healing,
  identify, light, detect monsters, fireball, cone of cold, and
  from Eye of the Beholder, turn undead and hold monster.
- Rings and amulets (a few each), including the amulet of
  reflection.
- No weight or encumbrance, no hunger.

## Rules that interact

Model these as data (an effect table keyed by item or spell, its
blessed/uncursed/cursed state, and the player's current statuses),
not as special cases scattered through the code, and cover them in
the rules tests.

- Blessed, uncursed, cursed: every potion and scroll has three
  outcomes, following NetHack where it has an answer. Examples:
  blessed healing heals more and can raise maximum HP; cursed gain
  level sends you up through the ceiling to the level above;
  blessed remove curse lifts curses on everything carried, uncursed
  only on what is worn or wielded; cursed enchant armor lowers the
  enchantment; cursed teleportation moves you to another level.
  Cursed weapons and armor stick once put on.
- Status effects on the player, each with a duration, a HUD icon,
  and a tooltip: confused, stunned, blind, hallucinating, asleep,
  paralyzed, levitating, fast, slowed, invisible, seeing invisible.
  Show them in the view where it makes sense (blindness blacks out
  the view but not the automap already seen; hallucination draws
  monsters as random other monsters; confusion sometimes turns a
  step into a different direction).
- Statuses change actions:
  - Reading a scroll while confused gives its NetHack confused
    effect, e.g. confused enchant weapon rustproofs the weapon,
    confused remove curse randomly blesses or curses carried items,
    confused teleportation becomes a level teleport.
  - Casting while confused or stunned can fail, drain the power
    anyway, and backfire. Scrolls and spellbooks cannot be read
    while blind. Failure chance also rises with heavy armor, as in
    NetHack.
  - Reading a spellbook too hard for the character's level can
    fail with a bad effect (paralysis, teleport, power drain).
    Cursed spellbooks always fail.
  - Drinking can cause statuses as well as cure them (sleeping,
    blindness, confusion, hallucination), and unknown potions are a
    gamble for that reason.
- A few more that make the dungeon feel like NetHack: quaffing from
  or dipping into a fountain can do several things (dipping a long
  sword at high enough level may make Excalibur); praying at an
  altar when in trouble can help or anger the god; dropping items
  on an altar reveals whether they are blessed or cursed; dipping
  an item in holy or unholy water blesses or curses it.
- When the player has not yet learned a rule, the message log
  should make cause and effect clear afterward, in NetHack's voice
  ("You are frozen by the floating eye's gaze!").

## Treasure, shops, and NPCs

- Gold is found in piles, on monsters, and in chests, and counts
  toward a NetHack-style score shown on the death and victory
  screens. Gems come as NetHack's do: unidentified, some valuable
  and some worthless glass.
- Chests and large boxes hold loot; some are locked (opened with a
  key, or forced at a risk of breaking a potion inside) and some
  are trapped. Occasionally a level has a closed vault of gold that
  can only be reached by a secret door or a switch.
- Shops are rooms with one door and a shopkeeper standing by it, as
  in NetHack: general stores plus specialist shops (weapons, armor,
  potions, scrolls and books, a lighting shop kept by Izchak).
  Talking to the shopkeeper opens a buy and sell panel and pauses
  the world clock while it is open. Unidentified items are priced
  by what they really are, so prices are a clue to identity.
  Selling pays less than buying costs. Attacking a shopkeeper is
  possible and close to suicidal.
- Other peaceful NPCs, there for lore and small services, not
  combat. Include four or five, such as:
  - temple priests, who tend an altar and give protection for a
    large enough donation
  - the Oracle on level 5
  - a vault guard who turns up if you are found in a vault and
    asks your name
  - a hermit, a lost adventurer, or a peaceful gnome or dwarf, who
    share rumors about this seed's dungeon
  - graves with epitaphs, including one for the player's last dead
    character if a previous run was saved
- NPCs speak in short NetHack-style lines in the message log or a
  small dialogue panel. Write a pool of lore and rumor lines (some
  true hints tied to the seed, some false, as in NetHack's fortune
  cookies) and draw from it with the seed.
- Peaceful NPCs are marked as peaceful and the game asks before
  attacking one ("Really attack the priest?"). Killing one has a
  lasting cost, such as bad luck or hostile shopkeepers.

## Seed and modifiers

- A run is fully determined by a seed (any string) plus modifiers.
  The seed first derives a default value for every modifier, then
  drives all generation. Same seed and modifiers must always produce
  the same game: use one seeded PRNG, with a separate stream per
  system so that changing one modifier does not reshuffle the rest.
- Modifiers, each with a defined range:
  - map size of the generated levels (depth is fixed at 25)
  - monster count, monster toughness, monster speed
  - loot amount and loot quality
  - share of items that are cursed, and that are blessed
  - gold and treasure amount
  - shop frequency and shop prices
  - how many peaceful NPCs appear
  - puzzles per level (locked doors, switches, pressure plates)
  - trap density
  - fountain and altar frequency
  - how safe resting is (chance of interruption)
  - share of items that start unidentified
- New-game screen: shows the seed (editable, with a randomize
  button) and every modifier with the value the seed gave it. The
  player can override any modifier; overridden values are marked and
  can be reset to the seed's value. Show an overall difficulty rating
  computed from the current values.
- Show a short run code that encodes the seed and any overrides, and
  accept a pasted code, so a run can be shared and replayed exactly.
  Display it on the death and victory screens as well.
- The run code and seed are also visible in the pause menu.

## Dungeon generation

- The dungeon is 25 levels deep, in 5 tiers of 5 levels. Each tier
  has its own wall set, music, and monster pool.
- Driven entirely by the seed and modifiers. Rooms joined by
  corridors, stairs up and down, size from the modifiers.
- Generate each level when first entered, from the seed and the
  level number, so the result does not depend on play order. Levels
  persist once visited and the player can go back up.
- Every fifth level is a special level based on a NetHack special
  level. These use a hand-authored layout with seeded variation,
  ignore the map-size modifier, and must still pass the solvability
  check:
  - 5, the Oracle: Delphi, with its centaur statues and fountains.
    For gold, the Oracle gives a true hint about this seed, e.g.
    which potion appearance is healing.
  - 10, Sokoban: a boulder-pushing puzzle. Boulders must not be able
    to make the level unwinnable without a reset; provide a reset.
    The prize is the amulet of reflection.
  - 15, Medusa: her gaze turns the player to stone unless they have
    reflection or are blind. Killing her opens the way down.
  - 20, the Castle: a walled keep with a drawbridge that must be
    opened, heavy guards, and a guaranteed powerful wand inside.
  - 25, the Wizard's Tower: the Wizard of Yendor and the Amulet.
- Puzzles are lock-and-key: colored doors, each opened by the
  matching colored key, plus wall switches and pressure plates that
  open gates elsewhere on the level, in the number the modifiers
  set. Occasionally a key found on one level opens a door on the
  next.
- Solvability is mandatory. Build each level as a region graph, place
  each lock on the path to the exit, and place its key or switch only
  in a region reachable before that lock. After generating, verify by
  simulation (flood fill, collecting keys and flipping switches) that
  the stairs are reachable; regenerate if not. A stuck player is the
  worst possible bug.
- Monsters scale by depth and by the modifiers. Loot follows the
  item lists above, with better items deeper.

## Automap

- Fills in as cells are seen. Toggle with M. Shows walls, doors in
  their key color (open vs locked), switches, stairs, and player
  position and facing. Kept per level. Drawn in code, in NetHack's
  ASCII style: `@` for the player, `<` `>` for stairs, `+` for
  doors, `{` for fountains, `_` for altars, `$` for gold, seen
  monsters as their NetHack letters, and peaceful NPCs as `@` in a
  distinct color. The minimap is a small always-on crop of it.

## Audio playback

- Play music and effects with HTMLAudioElement (`new Audio(path)`),
  not fetch plus decodeAudioData, which fails over file://.
- Start audio only after the first user input. Music changes with
  dungeon tier and for the boss. Separate music and effects volume,
  and a mute key.

## Controls

- Keyboard: W/S or arrows to step, A/D strafe, Q/E turn, Space
  attack, R rest, M map, I inventory, C cast, letter keys to pick
  an item or spell once a list is open.
- Also clickable on-screen movement and action buttons.

## Finish

- Title screen, new-game screen (seed, modifiers, class), death
  screen as a NetHack-style tombstone with cause of death, victory
  screen, restart with the same or a new seed.
- Save progress to localStorage inside try/catch; the game must work
  if storage is unavailable.
- Nothing stubbed: no TODOs, no placeholder functions.
- End the last session with a short report: time per job for each
  workflow, which assets were generated, which fell back, the
  audio files that are unverified by ear, and the make targets to
  rebuild and regenerate.
