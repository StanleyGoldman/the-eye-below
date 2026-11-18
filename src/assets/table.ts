// The ASSETS table: every drawable in the game, keyed by id. Each entry
// carries its code-drawn painter, which is what the game shows until a
// generated file for the same id is loaded over it (session 2), and what
// it falls back to if that file is missing.
//
// No DOM access here: painters receive a surface to draw on.

import { MONSTER_TYPES } from "../game/data/monsters.ts";
import { ROLES } from "../game/data/roles.ts";
import { ITEM_ICON_IDS, paintButton, paintCompass, paintDialoguePanel, paintFrame, paintItemIcon, paintShopPanel, paintSlot, paintTitle } from "./art-items.ts";
import { paintMonster, paintPortrait } from "./art-monsters.ts";
import { paintAltar, paintBoulder, paintCeil, paintChest, paintGrave, paintDoor, paintDrawbridge, paintFloor, paintFountain, paintGate, paintPlate, paintStairs, paintStatue, paintSwitch, paintTorch, paintTrapMark, paintWall } from "./art-world.ts";
import type { Pen } from "./pen.ts";

export type AssetKind = "texture" | "overlay" | "sprite" | "icon" | "ui";

/** How a frame can be made from its base picture when it has no file of its own. */
export type FrameOp = "same" | "flipV" | "flipH" | "leftHalf" | "leftEdge" | "topStrip";

export interface AssetDef {
  id: string;
  kind: AssetKind;
  w: number;
  h: number;
  paint: (p: Pen) => void;
  /** Set on animation frames: the base image they are a frame of. Frames are not "images" in the manifest's sense. */
  frame?: { of: string; op: FrameOp };
}

const table: Record<string, AssetDef> = {};

function add(id: string, kind: AssetKind, w: number, h: number, paint: (p: Pen) => void, frame?: { of: string; op: FrameOp }): void {
  table[id] = frame ? { id, kind, w, h, paint, frame } : { id, kind, w, h, paint };
}

for (let tier = 1; tier <= 5; tier++) {
  add(`wall_${tier}`, "texture", 64, 64, (p) => paintWall(p, tier));
  add(`floor_${tier}`, "texture", 64, 64, (p) => paintFloor(p, tier));
  add(`ceil_${tier}`, "texture", 64, 64, (p) => paintCeil(p, tier));
}

add("door", "overlay", 64, 64, (p) => paintDoor(p, "closed"));
add("door_half", "overlay", 64, 64, (p) => paintDoor(p, "half"), { of: "door", op: "leftHalf" });
add("door_open", "overlay", 64, 64, (p) => paintDoor(p, "open"), { of: "door", op: "leftEdge" });
add("gate", "overlay", 64, 64, (p) => paintGate(p, false));
add("gate_open", "overlay", 64, 64, (p) => paintGate(p, true), { of: "gate", op: "topStrip" });
add("drawbridge", "overlay", 64, 64, paintDrawbridge);
add("switch_off", "overlay", 64, 64, (p) => paintSwitch(p, "off"));
add("switch_on", "overlay", 64, 64, (p) => paintSwitch(p, "on"), { of: "switch_off", op: "flipV" });
add("lever", "overlay", 64, 64, (p) => paintSwitch(p, "reset"));
add("torch_1", "overlay", 64, 64, (p) => paintTorch(p, 0));
add("torch_2", "overlay", 64, 64, (p) => paintTorch(p, 1), { of: "torch_1", op: "flipH" });

add("stairs_down", "sprite", 64, 64, (p) => paintStairs(p, true));
add("stairs_up", "sprite", 64, 64, (p) => paintStairs(p, false));
add("fountain", "sprite", 64, 64, paintFountain);
add("altar", "sprite", 64, 64, paintAltar);
add("statue", "sprite", 64, 64, paintStatue);
add("boulder", "sprite", 64, 64, paintBoulder);
add("chest", "sprite", 64, 64, (p) => paintChest(p, false));
add("chest_open", "sprite", 64, 64, (p) => paintChest(p, true));
add("grave", "sprite", 64, 64, paintGrave);
add("plate", "sprite", 32, 32, paintPlate);
add("trap", "sprite", 32, 32, paintTrapMark);

for (const type of MONSTER_TYPES) {
  add(`monster_${type.id}`, "sprite", 64, 64, (p) => paintMonster(p, type.id, false));
  add(`monster_${type.id}_attack`, "sprite", 64, 64, (p) => paintMonster(p, type.id, true), { of: `monster_${type.id}`, op: "same" });
}

for (const id of ITEM_ICON_IDS) add(id, "icon", 32, 32, (p) => void paintItemIcon(p, id));

for (const role of ROLES) add(role.portrait, "ui", 48, 48, (p) => paintPortrait(p, role.id));

add("ui_frame", "ui", 64, 64, paintFrame);
add("ui_slot", "ui", 40, 40, paintSlot);
add("ui_button", "ui", 48, 24, paintButton);
add("ui_compass", "ui", 48, 48, paintCompass);
add("title_bg", "ui", 320, 180, paintTitle);
add("ui_shop", "ui", 320, 200, paintShopPanel);
add("ui_dialogue", "ui", 320, 80, paintDialoguePanel);

export const ASSETS: Readonly<Record<string, AssetDef>> = table;
