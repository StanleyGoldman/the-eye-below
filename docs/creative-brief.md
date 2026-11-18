# Creative brief: The Eye Below

Written in session 1. Later sessions follow it and may amend it,
giving the reason in `docs/decisions.md`.

## Title and premise

**The Eye Below.** A first-person, real-time, grid-step dungeon
crawler for one character, with roguelike rules.

Under the burnt hill town of Cinder lies the Cinderdeep: twenty-five
levels of cellars, mines, catacombs, and worse. At the bottom, in the
Hollow Tower, the magus Morvane keeps the Unblinking Eye, an amulet
that has not closed since it was made. The Guild of Honest Recovery
will pay for it and asks no questions. Go down, take the Eye from
Morvane, and the run is won.

The setting, names, level layouts, and all text are original to this
game. The play model is the early-1990s grid crawler; the rules
culture (unidentified items, blessings and curses, statuses that
change what actions do) is the classic roguelike one.

## Tone

Dry, second person, unimpressed. The log reports disasters the way a
clerk reports a filing error. Never cute, never grimdark for its own
sake. Cause and effect are always stated after the fact, so a rule
learned the hard way is at least learned.

- "You hit the floating eye. You are frozen by its gaze. This was
  avoidable."
- "The door is locked. The lock is red. You are not."
- "You feel full of awe. It passes."

## The dungeon

Five tiers of five levels. Every fifth level is a hand-authored
special level.

| Tier | Levels | Name | Walls | Special level |
|---|---|---|---|---|
| 1 | 1-5 | The Cellars | damp grey-brown brick | 5: the Oracle's Court |
| 2 | 6-10 | The Mines | ochre rock and timber | 10: the Stoneyard |
| 3 | 11-15 | The Catacombs | pale limestone, niches | 15: the Gorgon's Isle |
| 4 | 16-20 | The Undercroft | blue-black basalt, iron | 20: the Keep |
| 5 | 21-25 | The Tower Roots | obsidian with ember veins | 25: the Hollow Tower |

- **The Oracle's Court (5).** A colonnaded court with fountains and
  centaur statues. The oracle sells true statements about this seed.
- **The Stoneyard (10).** A boulder-pushing puzzle with pits to
  fill. A lever at the entrance resets it. The prize is the amulet
  of reflection.
- **The Gorgon's Isle (15).** Medusa, on an island reached by a
  causeway. Her gaze turns the unprotected to stone; reflection or
  blindness is protection. The gate to the stairs opens when she
  dies.
- **The Keep (20).** A moated, walled keep. The drawbridge is raised
  and its winch is in the gatehouse. Soldiers inside, and a
  guaranteed powerful wand in the strongroom.
- **The Hollow Tower (25).** Morvane and the Unblinking Eye.

## Palette

Muted and torchlit; 64 colors or fewer per image once processed.

- Stone: #2b2622, #4a4039, #6b5d50, #8c7b66, #b3a184
- Ochre and timber: #5a3d1e, #8a5a2b, #b9853f
- Limestone: #7d776a, #a39c8a, #cfc7b0
- Basalt and iron: #1b1f2a, #2e3546, #4c566b, #7a8699
- Obsidian and ember: #120d12, #2a1620, #7a2a1a, #d9632a, #f2b34a
- Flesh, blood, bile: #b98a6a, #7a1f1f, #6f7a2a
- Interface: iron #3a3d42, parchment #d8c9a3, lamp gold #e0b040,
  warning red #c03a2a, mana blue #3a6ac0, heal green #4a9a4a

## Monsters

Twenty regular monsters, four per tier, plus extras. The letter is
the automap glyph.

| Tier | Monster | Glyph | Rule worth learning |
|---|---|---|---|
| 1 | newt | `:` | none; it is a newt |
| 1 | jackal | `d` | fast, comes in packs |
| 1 | kobold | `k` | none |
| 1 | floating eye | `e` | never attacks; hit it in melee while you can see and you are paralyzed. Blindness, reflection, or free action protects |
| 2 | giant bat | `B` | erratic and fast |
| 2 | acid blob | `b` | passive acid corrodes the weapon that hits it unless rustproofed; bare hands burn |
| 2 | hill orc | `o` | comes in groups |
| 2 | dwarf | `h` | hits hard, well armored, drops its gear |
| 3 | soldier ant | `a` | very fast, attacks twice |
| 3 | cockatrice | `c` | its touch starts slow petrification; striking it bare-handed is instant |
| 3 | ghoul | `Z` | undead; paralyzing claws |
| 3 | leprechaun | `l` | steals gold and teleports away |
| 4 | troll | `T` | regenerates and gets up again unless finished with fire |
| 4 | wraith | `W` | undead; drains experience levels |
| 4 | stalker | `E` | invisible unless you can see invisible |
| 4 | ogre | `O` | slow, heavy blows that can stun |
| 5 | vampire | `V` | undead; drains and regenerates |
| 5 | minotaur | `H` | brutal |
| 5 | fire drake | `D` | breathes fire down corridors; reflection sends it back |
| 5 | lich | `L` | undead; casts cold bolts and curses |

Extras: water snake (`S`, from fountains), keep soldier (`s`, the
Keep), Medusa (`m`, level 15), Morvane (`M`, level 25).

## Peaceful characters

Peacefuls are marked as such, drawn in calm colors with open hands,
and the game asks before attacking one. Killing one costs luck for
the rest of the run.

- Session 1: the oracle (level 5).
- Session 2: shopkeepers (one per shop; the lamp shop is kept by
  Old Wick), temple priests, a hermit, a lost adventurer, and a
  peaceful gnome, who trade in rumors.
- Session 3: the vault guard.

## Roles

| Role | Plays as | Starting kit |
|---|---|---|
| Valkyrie | melee and armor; most HP; resists cold | long sword +1, dagger, small shield +3 |
| Wizard | spells; most Pw; fragile | quarterstaff, cloak, spellbook of force bolt (known), one random ring, one random wand, two random potions, two random scrolls |
| Rogue | speed and tricks; backstabs sleeping or fleeing monsters; throws daggers in volleys | short sword, six daggers, leather armor, one random potion |

Gods (for prayer): the Storm-Father (Valkyrie), the Lamplighter
(Wizard), the Quiet Hand (Rogue).

## Items

- **Weapons (12 plus 2 artifacts):** dagger, short sword, long sword,
  two-handed sword, mace, morning star, war hammer, axe, spear,
  quarterstaff, bow, arrows. Artifacts: Excalibur (a long sword
  dipped in a fountain by a worthy hand), Mjollnir (a war hammer,
  deep in the dungeon).
- **Armor:** leather armor, ring mail, chain mail, plate mail;
  leather cap, iron helm; small shield, large shield; low boots,
  iron shoes; cloak, cloak of protection.
- **Potions (11):** healing, extra healing, gain level, speed, see
  invisible, levitation, sleeping, blindness, confusion,
  hallucination, water.
- **Scrolls (8):** identify, enchant weapon, enchant armor, remove
  curse, magic mapping, teleportation, fire, scare monster.
- **Wands (6):** striking, magic missile, sleep, fire, cold,
  lightning.
- **Spellbooks and spells (11):** force bolt, sleep, healing, light,
  detect monsters, magic missile, hold monster, turn undead,
  identify, cone of cold, fireball.
- **Rings (6):** protection, regeneration, see invisible, free
  action, invisibility, teleportation.
- **Amulets (4 plus 1):** reflection, life saving, awareness,
  strangulation, and the Unblinking Eye.
- **Keys:** red, green, blue, brass (one per lock, consumed on use),
  and the bone key, which opens a door on the next level down.

Unidentified potions are known by a shuffled adjective ("a murky
potion"), scrolls by a shuffled nonsense label ("a scroll labeled
VORTH KELEM"), wands by material, rings by stone, amulets by shape,
spellbooks by binding.

## Art style rules

One STYLE string is appended to every image prompt (it goes into
`assets/prompts.json` in session 2):

> early-1990s VGA DOS dungeon crawler pixel art, 256-color palette,
> visible dithering, chunky hand-pixelled shading, torchlit, gritty
> and muted, not cute, not 16-bit console

- Sprites: single subject, front-facing, centered, full body, on a
  plain flat solid magenta background, no floor, no shadow, no text,
  no border.
- Textures: flat, straight-on, evenly lit, edge to edge, no
  perspective, no objects.
- HUD pieces: stone and iron. Text is always drawn in code.
- Hostile monsters lean forward, show teeth or weapons. Peacefuls
  stand upright, hands visible and empty or holding a lamp or book,
  in warmer and paler colors.
- Code-drawn placeholders (session 1) follow the same palette and
  the same sizes, so swapping in generated art changes nothing else.

## Amendments

- Session 2: the STYLE string and every other prompt fragment now
  live in `assets/prompts.json`, with the shared 64-colour palette.
  Reason: one place for the exact wording, as the build brief asks.
- Session 2: an **oil lamp** joins the item list (a tool; Old Wick
  sells it). Reason: the lamp shop needed stock.
- Session 2: shopkeepers have names drawn from a short list by the
  seed; the lamp shop's keeper is always Old Wick. The priest, the
  hermit, the lost adventurer, and the gnome are nameless.
- Session 2: the fire drake kept its wings. Both generated candidates
  had them and it reads better as a drake than a wingless one did in
  the code-drawn art.

## Interface rules

- Logical screen 960x540, scaled to the window by whole steps where
  possible. Viewport 304x208 drawn at twice its size.
- One pixel font throughout (VT323, bundled, OFL).
- Every number on screen has a tooltip that says what it is.
- Nothing blocks without telling the player why.
