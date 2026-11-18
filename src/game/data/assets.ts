// Which asset ids the game's data refers to. The audit checks that every
// one of them has an entry in the ASSETS table.

import { ITEM_TYPES } from "./items.ts";
import { MONSTER_TYPES } from "./monsters.ts";
import { ROLES } from "./roles.ts";

export function monsterSprite(typeId: string, attacking: boolean): string {
  return attacking ? `monster_${typeId}_attack` : `monster_${typeId}`;
}

export const FIXTURE_ASSETS: readonly string[] = [
  "door",
  "door_half",
  "door_open",
  "gate",
  "gate_open",
  "drawbridge",
  "switch_off",
  "switch_on",
  "lever",
  "torch_1",
  "torch_2",
  "stairs_down",
  "stairs_up",
  "fountain",
  "altar",
  "statue",
  "boulder",
  "chest",
  "chest_open",
  "grave",
  "plate",
  "trap",
];

export const UI_ASSETS: readonly string[] = ["ui_frame", "ui_slot", "ui_button", "ui_compass", "title_bg", "ui_shop", "ui_dialogue"];

export function requiredAssetIds(): string[] {
  const ids = new Set<string>();
  for (let tier = 1; tier <= 5; tier++) {
    ids.add(`wall_${tier}`);
    ids.add(`floor_${tier}`);
    ids.add(`ceil_${tier}`);
  }
  for (const id of FIXTURE_ASSETS) ids.add(id);
  for (const id of UI_ASSETS) ids.add(id);
  for (const t of ITEM_TYPES) ids.add(t.icon);
  for (const m of MONSTER_TYPES) {
    ids.add(monsterSprite(m.id, false));
    ids.add(monsterSprite(m.id, true));
  }
  for (const r of ROLES) ids.add(r.portrait);
  return [...ids].sort();
}
