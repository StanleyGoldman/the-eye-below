# Handoff from session 3

Written 2026-11-18. Release v1.0 "Full dark", tag `session-3`.
Sessions 1, 2, and 3 ran in one sitting (see `docs/decisions.md`).
This is the last planned session: nothing in `PROMPT.md` is left.

## What was done

Everything in `goals/session-3.md`'s scope.

- **Animation frames.** 30 frames made with the Qwen edit workflow,
  each from its base picture: an attack pose for 25 monsters and
  characters, `door_half`, `door_open`, `gate_open`, `switch_on`,
  `torch_2`. All cut out and processed. The frames of one animation
  are cropped with one shared box (`animationOf` in
  `scripts/lib/manifest.ts` says what belongs together), and the
  audit checks they share a size. Four were regenerated once:
  `monster_acid_blob_attack` (became a mushroom),
  `monster_morvane_attack` (no visible change),
  `monster_minotaur_attack` (grew a second axe), `door_open` (stray
  marks in the opening).
- **Six more images:** `chest`, `chest_open`, `grave`, `item_gem`,
  `item_chest_key`, `monster_guard`. The gem and the key were
  regenerated once each (a flat white disc; a chest instead of a
  key).
- **Music and sound.** 10 tracks from ACE-Step and 27 effects from
  Stable Audio, trimmed and normalized by `scripts/process.ts`.
  `sfx_zap` was regenerated once (its first attempt held a tenth of
  a second of sound). **No audio file has been listened to.**
- **Audio in the game:** `src/audio/audio.ts`. Starts on the first
  input; music chosen each frame from what is on screen; separate
  music and effects volumes in Settings; the mute key (N); settings
  kept in local storage; `?noaudio=1`.
- **Treasure:** chests and large boxes (locked, trapped, forced),
  chest keys, vaults behind hidden doors or switches, the vault
  guard, six gems and six kinds of glass, graves with epitaphs, and
  the grave of the last character to die. `src/game/treasure.ts`
  holds chests and the vault; the rest is in the generator, the
  actions, and the world tick.
- **Pipeline:** audio post-processing and its checks; shared-crop
  processing for animations; make rules for frames and audio;
  `audit-assets.ts --audio` and `--records`; one contact sheet per
  animation; `scripts/report.ts` and `make report`, which write
  `docs/asset-review.md` and `docs/final-report.md` from the
  records.
- **Checks:** 140 tests (14 new, in `tests/treasure.test.ts`); two
  new browser scenarios, `treasure` and `audio`; the sweep now
  counts vaults; the content audit checks that every sound the game
  plays has a file and every file is played.

## Numbers

- 176 manifest entries: 109 images, 30 frames, 10 music, 27 effects.
  No fallbacks.
- 349 jobs in `raw/generation-log.jsonl`, about 50 minutes of
  generation in all. Median job: Flux 2 26.7 s, Krea 2 14.8 s, Qwen
  edit 12.6 s, Z-Image 2.1 s, BiRefNet 0.7 s, ACE-Step 7.7 s for 72 s
  of music, Stable Audio 1.4 s. The table is in
  `docs/final-report.md`.

## What was deferred, and why

Nothing from the scope.

## Known flaws

- **All 37 audio files are unverified by ear.** They pass length and
  level checks and nothing more. Whether a loop's seam is audible,
  whether the tracks suit their tiers, and whether an effect sounds
  like its name are unknown. Sixteen effects hold less than a
  second of sound and are padded with silence to the one-second
  minimum; the amounts are in the final report.
- Some attack frames draw the figure a little smaller than its base
  picture (the model made room for a raised weapon): dwarf, hill
  orc, soldier, minotaur. The cockatrice's attack frame changes pose
  more than the others.
- The open chest is seen from a different angle than the closed one.
- The raised portcullis still shows its top two fifths.
- From session 2, unchanged: the fountain has a small flame on it,
  `floor_2` has a faint border when tiled, `ui_button` has a ragged
  edge, the fire drake has wings.
- The base pictures of animated monsters are drawn slightly smaller
  than in 0.2 where the attack frame reaches higher or wider, since
  both now share one crop.

Each is recorded against its asset in `docs/asset-review.md`.

## What a later session would need to know

- **The setting rule still holds.** Original names and layouts only;
  see the first entry in `docs/decisions.md`.
- **ComfyUI was stopped at the end of this session.** `make
  comfy-up` or any `comfy.ts gen` starts it again.
- **Do not run two manifest-changing commands at once.** `comfy.ts
  keep`, `regen`, and `gen` all rewrite `assets/manifest.json` and
  the records; a batch running in the background must finish first.
- **After a fresh clone run `make settle`** before `make assets`, or
  make may think committed files are stale.
- **After regenerating anything, run `make report`** and commit the
  two documents; `make goal-check SESSION=3` fails if the review
  table disagrees with the records.
- **The bundled ffmpeg is a 2018 build.** Check a filter option
  exists in it before using it.
- **`make goal-check SESSION=2` now asks for the session 3 manifest
  counts.** It still passes at `session-3`; the `session-2` tag is
  as it was.
- Save files from 0.2 are not loaded by 1.0 (save version 3); the
  title screen simply offers no "continue".

## Blocked

Nothing. No command outside the allowed list was needed.

## Final state

`make goal-check SESSION=3` and `git status` were run in the
session's conversation after the final commit and tag; all 26 checks
pass there. Checks 25 and 26 are made true by that commit and tag.
