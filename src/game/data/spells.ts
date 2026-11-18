// Spells. What each does lives in the effect table under "spell_<id>".

export interface SpellDef {
  id: string;
  name: string;
  level: number;
  blurb: string;
}

export const SPELLS: readonly SpellDef[] = [
  { id: "force_bolt", name: "force bolt", level: 1, blurb: "A blow of force against the first thing ahead, up to 4 cells away." },
  { id: "sleep", name: "sleep", level: 1, blurb: "A ray that puts everything in a line to sleep." },
  { id: "healing", name: "healing", level: 1, blurb: "Restores hit points, cures blindness, and halts petrification." },
  { id: "light", name: "light", level: 1, blurb: "Lights your surroundings for two minutes and maps what is near." },
  { id: "detect_monsters", name: "detect monsters", level: 1, blurb: "Shows every monster on the level on the map for a minute." },
  { id: "magic_missile", name: "magic missile", level: 2, blurb: "A ray of missiles through everything in a line. Stronger with your level." },
  { id: "hold_monster", name: "hold monster", level: 2, blurb: "The first monster ahead cannot move or attack for a while." },
  { id: "turn_undead", name: "turn undead", level: 2, blurb: "The dead in sight flee; the weak ones fall apart." },
  { id: "identify", name: "identify", level: 3, blurb: "Identifies one item of your choice." },
  { id: "cone_of_cold", name: "cone of cold", level: 4, blurb: "A ray of cold through everything ahead." },
  { id: "fireball", name: "fireball", level: 4, blurb: "Bursts on the first thing ahead and burns everything next to it. Mind the distance." },
];

const BY_ID = new Map(SPELLS.map((s) => [s.id, s]));

export function spellDef(id: string): SpellDef {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`unknown spell ${id}`);
  return s;
}

/** Power cost of a spell. */
export function spellCost(id: string): number {
  return spellDef(id).level * 5;
}
