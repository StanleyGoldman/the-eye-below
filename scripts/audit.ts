// Counts what the game contains and checks the content rules: enough of
// each kind of thing, three distinct outcomes for every potion and
// scroll, a confused outcome for every scroll, and a code-drawn entry in
// the ASSETS table for every asset id the game data refers to.
//
//   node scripts/audit.ts

import { ASSETS } from "../src/assets/table.ts";
import { MODIFIERS } from "../src/core/modifiers.ts";
import { requiredAssetIds } from "../src/game/data/assets.ts";
import { EFFECTS, lookupEffect } from "../src/game/data/effects.ts";
import { ITEM_TYPES } from "../src/game/data/items.ts";
import { regularMonsters } from "../src/game/data/monsters.ts";
import { ROLES } from "../src/game/data/roles.ts";
import { SPELLS } from "../src/game/data/spells.ts";
import { STATUS_IDS } from "../src/game/types.ts";
import type { Buc } from "../src/game/types.ts";

let failed = 0;

function check(ok: boolean, text: string): void {
  console.log(`${ok ? "ok  " : "FAIL"} ${text}`);
  if (!ok) failed++;
}

function atLeast(label: string, count: number, minimum: number): void {
  check(count >= minimum, `${label}: ${count} (at least ${minimum})`);
}

const ofClass = (cls: string): typeof ITEM_TYPES[number][] => ITEM_TYPES.filter((t) => t.cls === cls);

atLeast("weapons", ofClass("weapon").filter((t) => !t.artifact).length, 12);
atLeast("armor pieces", ofClass("armor").length, 10);
atLeast("potions", ofClass("potion").length, 10);
atLeast("scrolls", ofClass("scroll").length, 8);
atLeast("wands", ofClass("wand").length, 6);
atLeast("spells", SPELLS.length, 10);
atLeast("spellbooks", ofClass("spellbook").length, SPELLS.length);
atLeast("rings", ofClass("ring").length, 3);
atLeast("amulets", ofClass("amulet").length, 3);
atLeast("regular monsters", regularMonsters().length, 20);
for (let tier = 1; tier <= 5; tier++) atLeast(`monsters in tier ${tier}`, regularMonsters().filter((m) => m.tier === tier).length, 4);
check(ROLES.length === 3, `roles: ${ROLES.length} (exactly 3)`);
check(STATUS_IDS.length === 11, `player statuses: ${STATUS_IDS.length} (exactly 11)`);
atLeast("modifiers", MODIFIERS.length, 14);

const ops = (id: string, buc: Buc, confused: boolean): string => JSON.stringify(lookupEffect(id, { buc, has: (s) => confused && s === "confused", roll: () => 0.999 }).ops);
let distinct = 0;
let withConfused = 0;
const magic = [...ofClass("potion"), ...ofClass("scroll")];
for (const t of magic) {
  const [b, u, c] = [ops(t.id, "B", false), ops(t.id, "U", false), ops(t.id, "C", false)];
  if (b !== u && u !== c && b !== c) distinct++;
  else console.log(`     ${t.id} does not do three different things`);
}
check(distinct === magic.length, `potions and scrolls with three distinct outcomes (blessed, uncursed, cursed): ${distinct} of ${magic.length}`);
for (const t of ofClass("scroll")) {
  if (EFFECTS[t.id]?.some((r) => r.when === "confused") && ops(t.id, "U", true) !== ops(t.id, "U", false)) withConfused++;
  else console.log(`     ${t.id} has no confused outcome`);
}
check(withConfused === ofClass("scroll").length, `scrolls with a confused outcome: ${withConfused} of ${ofClass("scroll").length}`);
let ruled = 0;
const needRules = [...magic.map((t) => t.id), ...ofClass("wand").map((t) => t.id), ...SPELLS.map((s) => `spell_${s.id}`)];
for (const id of needRules) {
  if (EFFECTS[id]) ruled++;
  else console.log(`     ${id} has no entry in the effect table`);
}
check(ruled === needRules.length, `effect table entries for potions, scrolls, wands, and spells: ${ruled} of ${needRules.length}`);

const required = requiredAssetIds();
const missing = required.filter((id) => !ASSETS[id]);
for (const id of missing) console.log(`     no ASSETS entry for ${id}`);
check(missing.length === 0, `asset ids referred to by game data with a code-drawn ASSETS entry: ${required.length - missing.length} of ${required.length}`);
const unused = Object.keys(ASSETS).filter((id) => !required.includes(id));
check(unused.length === 0, `ASSETS entries nothing refers to: ${unused.length}${unused.length ? ` (${unused.join(", ")})` : ""}`);

console.log(failed === 0 ? "audit: ok" : `audit: ${failed} check(s) FAILED`);
process.exit(failed === 0 ? 0 : 1);
