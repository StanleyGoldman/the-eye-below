# Asset review

Every asset in `assets/manifest.json`, with what was decided about it. Written by `scripts/report.ts` from the generation records in `raw/` and the reviewer's remarks in `assets/review.json`; run `make report` after any regeneration.

The reviewer was the agent that built the game. Images and frames were looked at on contact sheets (`make sheet`, in `out/sheets/`) at the size the game shows them. Music and sound effects could not be listened to: they were only measured (length, level, how much is sound and how much padding), and every one is unverified by ear.

An asset may be generated three times: the first attempt and two more. After three rejected attempts it becomes a recorded fallback, and the game uses its code-drawn art, or silence.

## Images

109 entries; 41 needed more than one attempt; 0 fell back.

| Asset | Workflow | Attempts | Verdict | Remarks |
| --- | --- | --- | --- | --- |
| `wall_1` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `floor_1` | flux2 | 2 | kept attempt 2 | Looked at on the contact sheet at game size; reads as intended. Rejected: dark vignette toward the edges; shows as a grid when tiled |
| `ceil_1` | flux2 | 2 | kept attempt 2 | Regenerated once: the first attempt drew a room in perspective instead of a flat tile. Rejected: came out as a perspective view of a room with torches, not a flat texture |
| `wall_2` | flux2 | 2 | kept attempt 2 | Looked at on the contact sheet at game size; reads as intended. Rejected: the manifest entry changed |
| `floor_2` | flux2 | 2 | kept attempt 2 | Kept with a known flaw: a faint gravel border shows at the tile edge when the floor repeats. Rejected: the manifest entry changed |
| `ceil_2` | flux2 | 2 | kept attempt 2 | Looked at on the contact sheet at game size; reads as intended. Rejected: the manifest entry changed |
| `wall_3` | flux2 | 2 | kept attempt 2 | Looked at on the contact sheet at game size; reads as intended. Rejected: the manifest entry changed |
| `floor_3` | flux2 | 2 | kept attempt 2 | Looked at on the contact sheet at game size; reads as intended. Rejected: the manifest entry changed |
| `ceil_3` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `wall_4` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `floor_4` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `ceil_4` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `wall_5` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `floor_5` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `ceil_5` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `monster_newt` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `monster_jackal` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other candidate is as good; this one fills the frame better |
| `monster_kobold` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is squatter and less clear at small size |
| `monster_floating_eye` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is smoother and less gritty |
| `monster_giant_bat` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other has its wings cut off by the frame |
| `monster_acid_blob` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other has a cute face |
| `monster_hill_orc` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other has cartoon proportions |
| `monster_dwarf` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is smoother and hides the axe |
| `monster_soldier_ant` | krea2 | 2 | kept attempt 2 | Looked at on the contact sheet at game size; reads as intended. Rejected: the first reads as a spider: legs spread, body hidden |
| `monster_cockatrice` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is only a rooster; no lizard body |
| `monster_ghoul` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other stands upright; less of a hunched corpse-eater |
| `monster_leprechaun` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is as good; this one grins |
| `monster_troll` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is less hunched and lanky |
| `monster_wraith` | krea2 | 2 | kept attempt 2 | Looked at on the contact sheet at game size; reads as intended. Rejected: the first has no reaching hands and reads as an empty cloak |
| `monster_stalker` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is opaque grey, not translucent |
| `monster_ogre` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is rounder and cuter |
| `monster_vampire` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is cartoonish |
| `monster_minotaur` | krea2 | 2 | kept attempt 2 | Looked at on the contact sheet at game size; reads as intended. Rejected: the first is orange-skinned; the brief wants brown fur |
| `monster_fire_drake` | krea2 | 2 | kept attempt 1 | Kept with a known flaw: the drake has wings, which the brief did not ask for. Rejected: the other is chubby and cute |
| `monster_lich` | krea2 | 2 | kept attempt 2 | Looked at on the contact sheet at game size; reads as intended. Rejected: the first has a teal face that does not read as a skull |
| `monster_water_snake` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is coiled flat, not raised to strike |
| `monster_soldier` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other has cartoon proportions |
| `monster_medusa` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is smaller and darker; the snakes are harder to see |
| `monster_morvane` | krea2 | 2 | kept attempt 2 | Looked at on the contact sheet at game size; reads as intended. Rejected: the first is small and reads as a generic cultist |
| `monster_oracle` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other has no open palms |
| `monster_shopkeeper` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other looks hostile |
| `monster_priest` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is smaller in frame |
| `monster_hermit` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is less clear at small size |
| `monster_adventurer` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is as good; this one looks wearier |
| `monster_gnome` | krea2 | 2 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. Rejected: the other is as good; this one shows the lantern better |
| `door` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `gate` | flux2 | 1 | kept attempt 1 | Kept with a known flaw: the bars are heavier than asked for and the gaps are keyed from the uncut image, so a few edge pixels are rough. |
| `drawbridge` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `switch_off` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `lever` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `torch_1` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `stairs_down` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `stairs_up` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `fountain` | flux2 | 1 | kept attempt 1 | Kept with a known flaw: the model put a small flame on top of the basin. It still reads as a fountain. |
| `altar` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `statue` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `boulder` | flux2 | 2 | kept attempt 2 | Looked at on the contact sheet at game size; reads as intended. Rejected: the manifest entry changed |
| `plate` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `trap` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_dagger` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_short_sword` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_long_sword` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_two_handed_sword` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_mace` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_morning_star` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_war_hammer` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_axe` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_spear` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_quarterstaff` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_bow` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_arrow` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_leather_armor` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_ring_mail` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_chain_mail` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_plate_mail` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_leather_cap` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_iron_helm` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_small_shield` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_large_shield` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_low_boots` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_iron_shoes` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_cloak` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_cloak_of_protection` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_potion` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_scroll` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_spellbook` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_wand` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_ring` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_amulet` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_key` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_lamp` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_gold` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_eye` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `portrait_valkyrie` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `portrait_wizard` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `portrait_rogue` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `ui_frame` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `ui_slot` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `ui_button` | zimage | 3 | kept attempt 3 | Kept on the third and last attempt; the edge is slightly ragged. Rejected: had a white margin around the button Rejected: a stray cursor arrow is drawn in the corner |
| `ui_compass` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `ui_shop` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `ui_dialogue` | zimage | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `title_bg` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `chest` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `chest_open` | qwen_edit | 1 | kept attempt 1 | Kept with a known flaw: the edit turned the chest to a three-quarter view, so the open chest is not the closed one seen from the same side. Both read clearly. |
| `grave` | flux2 | 1 | kept attempt 1 | Looked at on the contact sheet at game size; reads as intended. |
| `item_gem` | zimage | 2 | kept attempt 2 | Second attempt. A faceted white stone, left pale so the game can tint it to each gem's colour. Rejected: Attempt 1 is a flat white octagon with no facets; it does not read as a gem. Prompt now asks for a faceted brilliant cut seen from the side. |
| `item_chest_key` | zimage | 2 | kept attempt 2 | Second attempt. A key alone. Rejected: Attempt 1 drew a chest with a key emblem, not a key. Prompt now asks for the key alone. |
| `monster_guard` | krea2 | 2 | kept attempt 2 | Two candidates; the second kept for its size in the frame and its readable lantern and keys. Rejected: Attempt 2 kept: broader figure that fills the frame, lantern and key ring both readable. Attempt 1 rejected: smaller and reads as an ordinary traveller. |

## Animation frames

30 entries; 4 needed more than one attempt; 0 fell back.

| Asset | Workflow | Attempts | Verdict | Remarks |
| --- | --- | --- | --- | --- |
| `monster_newt_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_jackal_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_kobold_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_giant_bat_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_acid_blob_attack` | qwen_edit | 2 | kept attempt 2 | Second attempt. Still a blob, now with a dripping maw. Rejected: Attempt 1 turned the blob into a mushroom with a stalk and cap; not the same creature. Prompt now forbids a stalk. |
| `monster_hill_orc_attack` | qwen_edit | 1 | kept attempt 1 | Kept with a known flaw: the figure is drawn a little smaller than in the base picture to make room for the raised club. |
| `monster_dwarf_attack` | qwen_edit | 1 | kept attempt 1 | Kept with a known flaw: the figure is drawn about a tenth smaller than in the base picture to make room for the raised axe. |
| `monster_soldier_ant_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_cockatrice_attack` | qwen_edit | 1 | kept attempt 1 | Kept with a known flaw: the wings spread and the body turns, a bigger change of pose than the other attack frames. It reads as a lunge. |
| `monster_ghoul_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_leprechaun_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_troll_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_wraith_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_stalker_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_ogre_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_vampire_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_minotaur_attack` | qwen_edit | 2 | kept attempt 2 | Second attempt. One axe, raised overhead. The figure is drawn a little smaller than in the base picture. Rejected: Attempt 1 gave the minotaur two axes; the base has one. Prompt now says one axe on a single shaft. |
| `monster_fire_drake_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_lich_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_water_snake_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_soldier_attack` | qwen_edit | 1 | kept attempt 1 | Kept with a known flaw: the figure is drawn a little smaller than in the base picture to make room for the raised sword. |
| `monster_medusa_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_morvane_attack` | qwen_edit | 2 | kept attempt 2 | Second attempt. The free arm reaches out and the staff is raised. Rejected: Attempt 1 is almost identical to the base picture; no attack is visible. Prompt now asks for an outstretched arm and raised staff. |
| `monster_shopkeeper_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `monster_priest_attack` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `switch_on` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `torch_2` | qwen_edit | 1 | kept attempt 1 | Looked at beside its base picture; same subject, same place in the frame, the change reads at game size. |
| `door_half` | qwen_edit | 1 | kept attempt 1 | Looked at beside the closed door: the leaf stands ajar inside an unchanged frame. |
| `door_open` | qwen_edit | 2 | kept attempt 2 | Second attempt. The leaf is folded back inside the left jamb and the opening is clean. Rejected: Attempt 1 left stray marks floating in the opening and the leaf overshoots the frame. Prompt now asks for a clean empty opening and an unchanged frame. |
| `gate_open` | qwen_edit | 1 | kept attempt 1 | Kept with a known flaw: the raised bars still fill the top two fifths of the opening rather than only the tips. It reads as a raised portcullis. |

## Music

10 entries; 0 needed more than one attempt; 0 fell back.

| Asset | Workflow | Attempts | Verdict | Remarks |
| --- | --- | --- | --- | --- |
| `music_title` | ace_step | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `music_tier1` | ace_step | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `music_tier2` | ace_step | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `music_tier3` | ace_step | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `music_tier4` | ace_step | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `music_tier5` | ace_step | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `music_calm` | ace_step | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `music_boss` | ace_step | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `music_death` | ace_step | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `music_victory` | ace_step | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |

## Sound effects

27 entries; 1 needed more than one attempt; 0 fell back.

| Asset | Workflow | Attempts | Verdict | Remarks |
| --- | --- | --- | --- | --- |
| `sfx_step` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only. It holds 0.21 s of sound; the rest of its 1.1 s is padding to reach the minimum length. |
| `sfx_bump` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_swing` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_hit` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only. It holds 0.24 s of sound, padded to 1.1 s. |
| `sfx_hurt` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_growl_beast` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_growl_humanoid` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_growl_undead` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_growl_insect` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_growl_reptile` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_growl_ooze` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_door` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_locked` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_key` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_pickup` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_switch` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_boulder` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_quaff` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_scroll` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_zap` | stable_audio | 2 | kept attempt 2 | Not heard. Measured only. Second attempt; the first held only 0.10 s of sound. Rejected: Attempt 1 holds only 0.10 s of sound once silence is trimmed; too short to hear as a wand. Prompt now asks for a crackle lasting a second. |
| `sfx_spell` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_levelup` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_stairs` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_coins` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_chest` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_shopbell` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |
| `sfx_purchase` | stable_audio | 1 | kept attempt 1 | Not heard. Measured only: length and level are within limits. |

176 rows for 176 manifest entries.
