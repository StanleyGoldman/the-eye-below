// Counts what the game contains and checks the content rules: enough of
// each kind of thing, three distinct outcomes for every potion and
// scroll, a confused outcome for every scroll, and a code-drawn entry in
// the ASSETS table for every asset id the game data refers to.
//
//   node scripts/audit.ts

import { readFileSync, readdirSync } from "node:fs";
import { ASSETS } from "../src/assets/table.ts";
import { MODIFIERS } from "../src/core/modifiers.ts";
import { requiredAssetIds } from "../src/game/data/assets.ts";
import { EFFECTS, lookupEffect } from "../src/game/data/effects.ts";
import { ITEM_TYPES } from "../src/game/data/items.ts";
import { MONSTER_TYPES, regularMonsters, soundFamily } from "../src/game/data/monsters.ts";
import { EPITAPHS, RUMORS } from "../src/game/data/rumors.ts";
import { SHOPS } from "../src/game/shops.ts";
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
atLeast("modifiers", MODIFIERS.length, 17);
atLeast("shop kinds", SHOPS.length, 5);
atLeast("kinds of peaceful character", MONSTER_TYPES.filter((m) => m.peaceful).length, 5);
atLeast("rumor lines", RUMORS.length, 40);
atLeast("rumor lines marked true", RUMORS.filter((r) => r.truth).length, 10);
atLeast("rumor lines marked false", RUMORS.filter((r) => !r.truth).length, 10);
atLeast("epitaphs", EPITAPHS.length, 12);
const gems = ofClass("gem");
atLeast("gems", gems.filter((t) => t.cost >= 100).length, 6);
atLeast("kinds of worthless glass", gems.filter((t) => t.cost < 10).length, 6);
const colours = [...new Set(gems.map((t) => t.gemColor))];
const paired = colours.filter((c) => gems.some((t) => t.gemColor === c && t.cost >= 100) && gems.some((t) => t.gemColor === c && t.cost < 10));
check(paired.length === colours.length, `gem colours that have both a real stone and a glass look-alike: ${paired.length} of ${colours.length}`);

// Every sound the game asks for has a file in the manifest, and every file is asked for.
const sources = ["src/main.ts", ...readdirSync("src/game").filter((f) => f.endsWith(".ts")).map((f) => `src/game/${f}`)].map((f) => readFileSync(f, "utf8")).join("\n");
const asked = new Set<string>();
for (const m of sources.matchAll(/kind: "sound", id: ([^}]+)\}/g)) for (const q of (m[1] as string).replace(/===\s*"[a-z_]+"/g, "").matchAll(/"([a-z_]+)"/g)) asked.add(`sfx_${q[1]}`);
for (const m of sources.matchAll(/audio\.effect\("(sfx_[a-z_]+)"\)/g)) asked.add(m[1] as string);
for (const t of MONSTER_TYPES) asked.add(`sfx_growl_${soundFamily(t.id)}`);
asked.delete("sfx_growl_");
const manifest = JSON.parse(readFileSync("assets/manifest.json", "utf8")) as { assets: { id: string; type: string }[] };
const effects = new Set(manifest.assets.filter((a) => a.type === "sfx").map((a) => a.id));
const noFile = [...asked].filter((id) => !effects.has(id));
const unplayed = [...effects].filter((id) => !asked.has(id));
check(noFile.length === 0, `sounds the game plays that have a manifest entry: ${asked.size - noFile.length} of ${asked.size}${noFile.length ? ` (${noFile.join(", ")})` : ""}`);
check(unplayed.length === 0, `sound effects in the manifest that nothing plays: ${unplayed.length}${unplayed.length ? ` (${unplayed.join(", ")})` : ""}`);
const tracks = new Set(manifest.assets.filter((a) => a.type === "music").map((a) => a.id));
const wanted = ["music_title", "music_calm", "music_boss", "music_death", "music_victory", "music_tier1", "music_tier2", "music_tier3", "music_tier4", "music_tier5"];
const noTrack = wanted.filter((id) => !tracks.has(id) || (!sources.includes(`"${id}"`) && !id.startsWith("music_tier")));
check(noTrack.length === 0 && tracks.size === wanted.length, `music tracks the game plays that have a manifest entry: ${wanted.length - noTrack.length} of ${wanted.length}`);

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
