# Final report

The Eye Below, v1.0 "Full dark". Written by `scripts/report.ts` from `raw/generation-log.jsonl` and the generation records; run `make report` to bring it up to date.

## Time per job, by workflow

Wall-clock seconds from submitting a job to ComfyUI to having its output downloaded, on this machine. The first job of a workflow loads its models, so it is listed apart from the median.

| Workflow | Used for | Jobs | First job (s) | Median (s) | Mean (s) | Fastest (s) | Slowest (s) | Total (min) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `image_flux2_text_to_image.json` | Flux 2: textures, fixtures, panels | 47 | 38.8 | 26.7 | 24.9 | 19.6 | 38.8 | 19.5 |
| `image_z_image_turbo.json` | Z-Image Turbo: icons, decals, small pieces | 47 | 14.2 | 2.1 | 3.7 | 2.1 | 14.2 | 2.9 |
| `image_krea2_turbo_int8_image_style_reference.json` | Krea 2 with a style reference: monsters, people, portraits | 61 | 21.8 | 14.8 | 15.0 | 14.1 | 22.5 | 15.3 |
| `image_qwen_image_edit_2511.json` | Qwen Image Edit: animation frames from a base picture | 36 | 23.9 | 12.6 | 13.9 | 11.9 | 25.3 | 8.3 |
| `utility_birefnet_remove_background.json` | BiRefNet: background removal | 118 | 2.8 | 0.7 | 0.8 | 0.7 | 2.8 | 1.5 |
| `audio_ace_step1_5_xl_turbo.json` | ACE-Step: music | 11 | 13.3 | 7.7 | 8.2 | 2.1 | 18.4 | 1.5 |
| `audio_stable_audio_3_medium.json` | Stable Audio: sound effects | 29 | 7.9 | 1.4 | 2.1 | 1.4 | 7.9 | 1.0 |

349 successful jobs in all, 50 minutes of generation; 0 failed jobs in the log. The counts include the first test job of each workflow, kept in `raw/tests/`.

What was asked of each workflow, from the manifest:

- `image_flux2_text_to_image.json`: 19 at 512 by 512 pixels, 17 at 1024 by 1024 pixels, 1 at 1280 by 720 pixels.
- `image_z_image_turbo.json`: 38 at 512 by 512 pixels, 1 at 1024 by 512 pixels, 1 at 1024 by 640 pixels, 1 at 1024 by 256 pixels.
- `image_krea2_turbo_int8_image_style_reference.json`: 30 at 1024 by 1024 pixels.
- `image_qwen_image_edit_2511.json`: 31 at 1024 by 1024 pixels.
- `audio_ace_step1_5_xl_turbo.json`: 8 at 72 s of audio, 2 at 16 s of audio.
- `audio_stable_audio_3_medium.json`: 13 at 1.5 s of audio, 5 at 2.5 s of audio, 9 at 2 s of audio.
- `utility_birefnet_remove_background.json`: every transparent image and frame, at the size it was generated.

## Assets generated

| Type | Entries | Generated | Fell back | Attempts | Rejected attempts | Entries that needed more than one attempt |
| --- | --- | --- | --- | --- | --- | --- |
| Images | 109 | 109 | 0 | 151 | 42 | 41 |
| Animation frames | 30 | 30 | 0 | 34 | 4 | 4 |
| Music | 10 | 10 | 0 | 10 | 0 | 0 |
| Sound effects | 27 | 27 | 0 | 28 | 1 | 1 |
| All | 176 | 176 | 0 | 223 | 47 | 46 |

A rejected attempt is either one that was regenerated or the unchosen one of two candidates. 112 of the images and frames also went through background removal. Every image and frame was scaled down with nearest-neighbour sampling and mapped to the shared 64-colour palette; the frames of one animation share one crop box. Every audio file had its silence trimmed and its loudness set. The verdict on each asset is in `docs/asset-review.md`.

## Assets that fell back

None. No asset used up its three attempts, so nothing in the finished game is drawn by code or left silent for want of a generated file. The code-drawn art and the silent fallback are still there: `index.html?noassets=1` and `index.html?noaudio=1` play the game on them alone.

## Audio files unverified by ear

All 37 of them. The agent that built the game cannot listen: each file was checked only by measurement (length within its limits, mean level above -45 dB, at least 0.2 s of sound once silence is trimmed). Whether a track suits its level, whether a loop's seam is audible, and whether an effect sounds like what its name says are all unchecked. Please listen to each before relying on it.

| File | Used for | Length (s) | Of which sound (s) | Mean level (dB) | Attempts |
| --- | --- | --- | --- | --- | --- |
| `assets/music/music_title.mp3` | ominous slow title theme, low brass and choir pad, a single tolling bell | 64.8 | 64.81 | -19.4 | 1 |
| `assets/music/music_tier1.mp3` | damp cellar exploration, sparse plucked strings and soft dripping water, cautious | 66.4 | 66.38 | -21.3 | 1 |
| `assets/music/music_tier2.mp3` | mine exploration, steady hammered percussion like distant picks, low woodwinds | 67.5 | 67.47 | -18.8 | 1 |
| `assets/music/music_tier3.mp3` | catacomb exploration, hollow flute over a slow organ drone, eerie and still | 67.3 | 67.27 | -18.6 | 1 |
| `assets/music/music_tier4.mp3` | cold stone keep, martial snare drum and low strings, tense and watchful | 68.0 | 68.00 | -19.4 | 1 |
| `assets/music/music_tier5.mp3` | volcanic obsidian depths, heavy low drums and dissonant brass swells, dread | 70.4 | 70.40 | -19.1 | 1 |
| `assets/music/music_calm.mp3` | calm shop and temple theme, warm harp and soft recorder, gentle and safe | 66.0 | 66.04 | -20.9 | 1 |
| `assets/music/music_boss.mp3` | boss battle, fast driving percussion and urgent brass stabs, relentless | 68.7 | 68.68 | -19.1 | 1 |
| `assets/music/music_death.mp3` | funeral sting, slow descending organ chords and one final low bell | 12.4 | 12.38 | -20.6 | 1 |
| `assets/music/music_victory.mp3` | triumphant fanfare, bright brass and timpani, resolving on a major chord | 13.1 | 13.09 | -21.7 | 1 |
| `assets/sfx/sfx_step.mp3` | a single footstep on a stone floor | 1.1 | 0.21 | -28.0 | 1 |
| `assets/sfx/sfx_bump.mp3` | a dull thud of a body bumping into a stone wall | 1.1 | 0.47 | -23.8 | 1 |
| `assets/sfx/sfx_swing.mp3` | a sword blade swishing through the air | 1.1 | 0.44 | -23.2 | 1 |
| `assets/sfx/sfx_hit.mp3` | a blade striking flesh with a heavy thud | 1.1 | 0.23 | -31.6 | 1 |
| `assets/sfx/sfx_hurt.mp3` | a short grunt of pain from a grown adult | 1.1 | 0.47 | -23.1 | 1 |
| `assets/sfx/sfx_growl_beast.mp3` | a low animal growl ending in a snarl | 1.4 | 1.38 | -12.2 | 1 |
| `assets/sfx/sfx_growl_humanoid.mp3` | a guttural goblin grunt and bark | 1.1 | 1.15 | -19.7 | 1 |
| `assets/sfx/sfx_growl_undead.mp3` | a dry rasping moan from a corpse | 1.5 | 1.49 | -15.0 | 1 |
| `assets/sfx/sfx_growl_insect.mp3` | a giant insect chittering and clicking | 1.2 | 1.23 | -20.7 | 1 |
| `assets/sfx/sfx_growl_reptile.mp3` | a sharp reptile hiss | 1.1 | 1.04 | -16.0 | 1 |
| `assets/sfx/sfx_growl_ooze.mp3` | a wet gurgling squelch of slime | 1.1 | 1.04 | -23.2 | 1 |
| `assets/sfx/sfx_door.mp3` | a heavy wooden door creaking open on rusty hinges | 2.0 | 1.99 | -19.2 | 1 |
| `assets/sfx/sfx_locked.mp3` | a locked iron door handle rattling | 1.1 | 0.60 | -28.4 | 1 |
| `assets/sfx/sfx_key.mp3` | a small metal key jingling as it is picked up | 1.1 | 0.42 | -29.0 | 1 |
| `assets/sfx/sfx_pickup.mp3` | a soft rustle of an item dropped into a leather pack | 1.1 | 0.29 | -21.0 | 1 |
| `assets/sfx/sfx_switch.mp3` | a stone lever clunking into place | 1.1 | 0.39 | -28.6 | 1 |
| `assets/sfx/sfx_boulder.mp3` | a large boulder grinding across a stone floor | 1.5 | 1.46 | -20.6 | 1 |
| `assets/sfx/sfx_quaff.mp3` | two quick gulps of liquid from a bottle | 1.1 | 0.42 | -24.3 | 1 |
| `assets/sfx/sfx_scroll.mp3` | a parchment scroll unrolling and crackling | 1.1 | 0.91 | -24.2 | 1 |
| `assets/sfx/sfx_zap.mp3` | a magic wand discharging: a sharp electric crackle that rises and fizzles out over one second | 1.1 | 0.60 | -30.3 | 2 |
| `assets/sfx/sfx_spell.mp3` | a shimmering magical whoosh of a spell being cast | 1.1 | 0.99 | -22.3 | 1 |
| `assets/sfx/sfx_levelup.mp3` | a bright short rising chime | 1.2 | 1.23 | -16.6 | 1 |
| `assets/sfx/sfx_stairs.mp3` | hurried footsteps descending stone stairs | 1.1 | 1.07 | -24.2 | 1 |
| `assets/sfx/sfx_coins.mp3` | a handful of gold coins clinking together | 1.1 | 0.29 | -29.8 | 1 |
| `assets/sfx/sfx_chest.mp3` | a wooden chest lid creaking open | 1.1 | 1.10 | -26.5 | 1 |
| `assets/sfx/sfx_shopbell.mp3` | a small brass shop door bell ringing once | 1.1 | 0.68 | -24.9 | 1 |
| `assets/sfx/sfx_purchase.mp3` | coins dropped onto a wooden counter | 1.1 | 0.47 | -28.0 | 1 |

## Make targets to rebuild and regenerate

Rebuilding the game needs Node and nothing else; regenerating assets needs the local ComfyUI.

| Command | What it does |
| --- | --- |
| `make build` | Bundle `src/` into `dist/game.js`. Then open `index.html`. |
| `make check` | Typecheck, tests, build, and the headless browser smoke run. |
| `make test` | The unit tests. |
| `make sweep` | Generate 3300 levels across all modifiers and verify each is solvable. |
| `make goal-check SESSION=3` | Every acceptance check of a session, one PASS or FAIL line each. |
| `make assets` | Bring every asset up to date: generate what is missing or whose manifest entry changed, cut out, post-process. Starts ComfyUI if it has to. Does nothing when all is current. |
| `make base / styled / frames / music / sfx` | Only that stage of generation. |
| `make cutouts` | Background removal for whatever needs it. |
| `make processed` | Post-processing only; needs no ComfyUI. |
| `make sheet` | Contact sheets in `out/sheets/`, one per kind and one per animation. |
| `make report` | Rewrite this file and `docs/asset-review.md` from the records. |
| `make comfy-up / comfy-down / comfy-status` | Start, stop, or report on ComfyUI. Only an instance this build started is ever stopped. |
| `make settle` | After a fresh clone: mark the committed raw files, cutouts, and assets up to date, in that order, so `make assets` does not regenerate them. |
| `make clean` | Remove the bundle and the typecheck stamp. Never touches assets or `raw/`. |
| `make clean-assets` | Remove the processed files in `assets/` and the contact sheets; `raw/` is kept, so `make processed` brings them back without generating anything. |

To regenerate one asset: change its prompt or seed in `assets/manifest.json` and run `make assets`, or run `node scripts/comfy.ts regen --id <asset> --note "why"` to reject the kept attempt and make another (at most two regenerations), then `make assets`. To give up on one: `node scripts/comfy.ts fallback --id <asset> --note "why"`.
