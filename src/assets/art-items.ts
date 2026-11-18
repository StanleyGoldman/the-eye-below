// Code-drawn item icons (32x32) and HUD pieces. Magic item classes get
// one pale, neutral icon each, tinted in code for their shuffled looks.

import type { Pen } from "./pen.ts";

const STEEL = "#c0c4c8";
const STEEL_DARK = "#6a7078";
const WOOD = "#7a5228";
const WOOD_DARK = "#4a2f14";
const GOLD = "#e0b040";

function blade(p: Pen, length: number, width: number, guard: number): void {
  const x = 16;
  const top = 28 - length;
  p.rect(x - Math.floor(width / 2), top + 2, width, length - 6, STEEL);
  p.rect(x - Math.floor(width / 2), top + 2, 1, length - 6, "#f0f0f0");
  p.tri(x - width / 2, top + 2, x + width / 2, top + 2, x, top - 1, STEEL);
  p.rect(x - guard, 24, guard * 2, 2, GOLD);
  p.rect(x - 1, 26, 2, 4, WOOD_DARK);
  p.px(x, 30, GOLD);
}

function shaft(p: Pen, top: number, bottom: number): void {
  p.rect(15, top, 2, bottom - top, WOOD);
  p.rect(15, top, 1, bottom - top, "#9a6c36");
}

const WEAPON_ICONS: Record<string, (p: Pen) => void> = {
  dagger: (p) => blade(p, 14, 3, 3),
  short_sword: (p) => blade(p, 20, 3, 4),
  long_sword: (p) => blade(p, 26, 3, 5),
  two_handed_sword: (p) => blade(p, 28, 5, 7),
  mace: (p) => {
    shaft(p, 12, 30);
    p.ell(16, 8, 6, 6, STEEL_DARK);
    p.ell(15, 7, 3, 3, STEEL);
    for (const [x, y] of [[9, 8], [23, 8], [16, 1], [11, 3], [21, 3]] as const) p.px(x, y, STEEL);
  },
  morning_star: (p) => {
    shaft(p, 14, 30);
    p.ell(16, 9, 5, 5, STEEL_DARK);
    for (const [dx, dy] of [[-7, 0], [7, 0], [0, -7], [-5, -5], [5, -5], [-5, 5], [5, 5]] as const) p.line(16, 9, 16 + dx, 9 + dy, STEEL);
  },
  war_hammer: (p) => {
    shaft(p, 8, 30);
    p.rect(8, 3, 16, 8, STEEL_DARK);
    p.rect(8, 3, 16, 2, STEEL);
    p.rect(8, 3, 2, 8, STEEL);
  },
  axe: (p) => {
    shaft(p, 4, 30);
    p.tri(17, 4, 17, 16, 27, 10, STEEL);
    p.tri(17, 6, 17, 14, 23, 10, STEEL_DARK);
    p.tri(15, 6, 15, 14, 9, 10, STEEL_DARK);
  },
  spear: (p) => {
    shaft(p, 8, 31);
    p.tri(13, 9, 19, 9, 16, 0, STEEL);
    p.px(16, 4, "#f0f0f0");
  },
  quarterstaff: (p) => {
    p.line(6, 29, 26, 3, WOOD, 2);
    p.line(6, 28, 25, 3, "#9a6c36");
    p.rect(5, 27, 3, 3, STEEL_DARK);
    p.rect(24, 2, 3, 3, STEEL_DARK);
  },
  bow: (p) => {
    for (let i = 0; i <= 26; i++) {
      const t = (i - 13) / 13;
      p.rect(10 + Math.round((1 - t * t) * 10), 3 + i, 2, 1, WOOD);
    }
    p.line(10, 3, 10, 29, "#e4dcc6");
  },
  arrow: (p) => {
    p.line(6, 26, 24, 8, WOOD);
    p.tri(22, 6, 27, 5, 26, 10, STEEL);
    p.line(6, 26, 4, 22, "#e4dcc6");
    p.line(6, 26, 10, 28, "#e4dcc6");
  },
};

function bodyArmor(p: Pen, main: string, dark: string, pattern: "plain" | "rings" | "chain" | "plate"): void {
  p.rect(8, 6, 16, 22, main);
  p.rect(4, 6, 5, 9, main);
  p.rect(23, 6, 5, 9, main);
  p.rect(13, 4, 6, 3, "#101010");
  p.dither(16, 8, 8, 20, dark);
  p.rect(8, 27, 16, 1, dark);
  if (pattern === "rings") for (let y = 9; y < 26; y += 4) for (let x = 10; x < 23; x += 4) p.px(x, y, "#f0f0f0");
  if (pattern === "chain") p.dither(8, 8, 16, 19, "#f0f0f0");
  if (pattern === "plate") {
    p.rect(8, 6, 16, 2, "#f0f0f0");
    p.rect(15, 8, 2, 19, dark);
    p.rect(8, 16, 16, 1, dark);
  }
}

const ARMOR_ICONS: Record<string, (p: Pen) => void> = {
  leather_armor: (p) => bodyArmor(p, "#8a5a2b", "#5a3d1e", "plain"),
  ring_mail: (p) => bodyArmor(p, "#6a5a4a", "#3a3028", "rings"),
  chain_mail: (p) => bodyArmor(p, "#7a8088", "#4a5058", "chain"),
  plate_mail: (p) => bodyArmor(p, "#a8b0b8", "#5a6068", "plate"),
  leather_cap: (p) => {
    p.ell(16, 16, 10, 8, "#8a5a2b");
    p.rect(6, 17, 20, 8, "#8a5a2b");
    p.dither(16, 10, 10, 15, "#5a3d1e");
    p.rect(6, 23, 20, 2, "#5a3d1e");
  },
  iron_helm: (p) => {
    p.ell(16, 15, 10, 9, STEEL);
    p.rect(6, 16, 20, 9, STEEL);
    p.dither(16, 8, 10, 17, STEEL_DARK);
    p.rect(6, 19, 20, 2, STEEL_DARK);
    p.rect(15, 19, 2, 8, STEEL_DARK);
    p.tri(13, 6, 19, 6, 16, 1, "#7a1f1f");
  },
  small_shield: (p) => {
    p.ell(16, 16, 9, 10, WOOD);
    p.ell(16, 16, 7, 8, "#9a6c36");
    p.ell(16, 16, 3, 3, STEEL);
    p.ditherEll(18, 18, 6, 7, WOOD_DARK);
  },
  large_shield: (p) => {
    p.rect(6, 4, 20, 16, STEEL);
    p.tri(6, 20, 26, 20, 16, 30, STEEL);
    p.rect(8, 6, 16, 13, "#7a1f1f");
    p.tri(8, 19, 24, 19, 16, 27, "#7a1f1f");
    p.rect(15, 6, 2, 20, GOLD);
    p.rect(8, 12, 16, 2, GOLD);
  },
  low_boots: (p) => {
    for (const x of [6, 18]) {
      p.rect(x, 10, 6, 14, "#8a5a2b");
      p.rect(x, 22, 9, 5, "#8a5a2b");
      p.rect(x, 26, 9, 2, "#3a2412");
    }
  },
  iron_shoes: (p) => {
    for (const x of [6, 18]) {
      p.rect(x, 12, 6, 12, STEEL_DARK);
      p.rect(x, 22, 9, 5, STEEL);
      p.rect(x, 26, 9, 2, "#2a2e34");
      p.rect(x, 12, 6, 1, "#f0f0f0");
    }
  },
  cloak: (p) => {
    p.tri(16, 3, 4, 29, 28, 29, "#5a5a70");
    p.dither(16, 6, 10, 23, "#34344a");
    p.rect(13, 3, 6, 3, GOLD);
  },
  cloak_of_protection: (p) => {
    p.tri(16, 3, 4, 29, 28, 29, "#3a6ac0");
    p.dither(16, 6, 10, 23, "#1a2a60");
    p.rect(13, 3, 6, 3, GOLD);
    p.px(12, 20, "#ffffff");
    p.px(20, 14, "#ffffff");
  },
};

/** Neutral icons for the classes that are tinted by appearance. Liquid, paper, and stone areas are near-white. */
const CLASS_ICONS: Record<string, (p: Pen) => void> = {
  item_potion: (p) => {
    p.rect(13, 3, 6, 3, "#8a6a4a");
    p.rect(14, 6, 4, 6, "#d0d8e0");
    p.ell(16, 20, 9, 9, "#f4f4f4");
    p.ell(16, 20, 8, 8, "#e0e0e0");
    p.ditherEll(18, 22, 6, 6, "#b0b0b0");
    p.rect(8, 14, 16, 2, "#f8f8f8");
    p.px(12, 17, "#ffffff");
    p.px(13, 16, "#ffffff");
  },
  item_scroll: (p) => {
    p.rect(6, 8, 20, 16, "#f0ead8");
    p.dither(16, 9, 10, 14, "#d0c8b0");
    p.rect(5, 6, 22, 3, "#c8c0a8");
    p.rect(5, 23, 22, 3, "#c8c0a8");
    for (let y = 12; y < 22; y += 3) p.rect(9, y, 14 - ((y * 3) % 5), 1, "#6a6050");
  },
  item_spellbook: (p) => {
    p.rect(6, 5, 20, 22, "#e8e8e8");
    p.rect(6, 5, 3, 22, "#909090");
    p.dither(16, 6, 10, 20, "#b8b8b8");
    p.rect(24, 6, 2, 21, "#f8f4e0");
    p.rect(12, 11, 9, 9, "#707070");
    p.rect(14, 13, 5, 5, "#f0f0f0");
  },
  item_wand: (p) => {
    p.line(7, 26, 24, 7, "#e8e8e8", 2);
    p.line(7, 25, 23, 7, "#ffffff");
    p.rect(5, 25, 4, 4, "#707070");
    p.px(26, 5, "#ffffff");
    p.px(27, 8, "#f0e060");
    p.px(23, 4, "#f0e060");
  },
  item_ring: (p) => {
    p.ell(16, 19, 8, 8, GOLD);
    for (let y = 14; y < 24; y++) for (let x = 11; x < 21; x++) if ((x - 16) ** 2 + (y - 19) ** 2 < 26) p.clear(x, y, 1, 1);
    p.ell(16, 9, 4, 4, "#f0f0f0");
    p.ditherEll(17, 10, 3, 3, "#b0b0b0");
    p.px(14, 7, "#ffffff");
  },
  item_amulet: (p) => {
    p.line(8, 3, 16, 16, "#8a8f96");
    p.line(24, 3, 16, 16, "#8a8f96");
    p.ell(16, 21, 6, 7, "#f0f0f0");
    p.ditherEll(17, 22, 4, 5, "#b0b0b0");
    p.ell(16, 21, 2, 2, "#707070");
  },
  item_key: (p) => {
    p.ell(10, 10, 6, 6, "#f0f0f0");
    for (let y = 7; y < 14; y++) for (let x = 7; x < 14; x++) if ((x - 10) ** 2 + (y - 10) ** 2 < 8) p.clear(x, y, 1, 1);
    p.line(14, 14, 26, 26, "#f0f0f0", 2);
    p.rect(22, 25, 2, 4, "#e0e0e0");
    p.rect(26, 21, 4, 2, "#e0e0e0");
    p.dither(8, 8, 6, 6, "#b0b0b0");
  },
  item_gold: (p) => {
    for (const [x, y] of [[10, 24], [20, 24], [15, 20], [8, 19], [22, 18], [15, 14]] as const) {
      p.ell(x, y, 5, 3, "#8a6a2a");
      p.ell(x, y - 1, 5, 3, GOLD);
      p.px(x - 2, y - 2, "#fff0b0");
    }
  },
  item_lamp: (p) => {
    p.ell(15, 22, 9, 5, "#8a6a2a");
    p.ell(15, 21, 8, 4, "#c9a23a");
    p.rect(22, 19, 7, 3, "#c9a23a");
    p.rect(4, 18, 3, 6, "#8a6a2a");
    p.rect(11, 26, 9, 2, "#8a6a2a");
    p.ell(28, 15, 2, 3, "#f08030");
    p.px(28, 13, "#fff0b0");
  },
  item_eye: (p) => {
    p.line(8, 2, 16, 12, GOLD);
    p.line(24, 2, 16, 12, GOLD);
    p.ell(16, 20, 10, 9, GOLD);
    p.ell(16, 20, 8, 7, "#f4f0e0");
    p.ell(16, 20, 4, 5, "#d9632a");
    p.ell(16, 20, 1, 4, "#101010");
    p.px(14, 17, "#ffffff");
  },
};

export function paintItemIcon(p: Pen, id: string): boolean {
  const key = id.startsWith("item_") ? id.slice(5) : id;
  const paint = WEAPON_ICONS[key] ?? ARMOR_ICONS[key] ?? CLASS_ICONS[id];
  if (!paint) return false;
  paint(p);
  return true;
}

export const ITEM_ICON_IDS: readonly string[] = [...Object.keys(WEAPON_ICONS).map((k) => `item_${k}`), ...Object.keys(ARMOR_ICONS).map((k) => `item_${k}`), ...Object.keys(CLASS_ICONS)];

// ---- HUD pieces --------------------------------------------------------

export function paintFrame(p: Pen): void {
  p.rect(0, 0, 64, 64, "#3a3d42");
  for (let i = 0; i < 40; i++) p.ell(p.rng.int(64), p.rng.int(64), 2 + p.rng.int(5), 1 + p.rng.int(3), p.rng.pick(["#34373c", "#40444a", "#2e3136"]));
  p.speckle(0, 0, 64, 64, ["#2a2c30", "#4a4e54"], 0.08);
}

export function paintSlot(p: Pen): void {
  p.rect(0, 0, 40, 40, "#1c1d20");
  p.rect(1, 1, 38, 38, "#2a2c30");
  p.rect(0, 0, 40, 1, "#101113");
  p.rect(0, 0, 1, 40, "#101113");
  p.rect(0, 39, 40, 1, "#55575c");
  p.rect(39, 0, 1, 40, "#55575c");
  p.dither(2, 2, 36, 36, "#242629");
}

export function paintButton(p: Pen): void {
  p.rect(0, 0, 48, 24, "#55575c");
  p.rect(0, 0, 48, 2, "#8a8f96");
  p.rect(0, 0, 2, 24, "#8a8f96");
  p.rect(0, 22, 48, 2, "#2a2c30");
  p.rect(46, 0, 2, 24, "#2a2c30");
  p.dither(2, 12, 44, 10, "#4a4c50");
}

export function paintCompass(p: Pen): void {
  p.ell(24, 24, 22, 22, "#2a2c30");
  p.ell(24, 24, 20, 20, "#8a6a2a");
  p.ell(24, 24, 17, 17, "#1c1d20");
  for (const [x, y] of [[24, 4], [24, 44], [4, 24], [44, 24]] as const) p.rect(x - 1, y - 1, 2, 2, "#e0b040");
}

export function paintTitle(p: Pen): void {
  p.rect(0, 0, 320, 180, "#0a070a");
  // A stair descending into the dark, and far below it one open eye.
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const w = 280 - t * 220;
    const y = 170 - i * 9;
    const shade = Math.round(90 - t * 80);
    p.rect(160 - w / 2, y, w, 8, `rgb(${shade + 20},${shade + 8},${shade})`);
    p.rect(160 - w / 2, y, w, 1, `rgb(${shade + 50},${shade + 34},${shade + 20})`);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const x = 160 + side * (150 - i * 15);
      p.rect(x - 5, 20 + i * 4, 10, 150 - i * 12, `rgb(${40 - i * 4},${34 - i * 3},${30 - i * 3})`);
    }
  }
  p.speckle(0, 0, 320, 180, ["#1c1815", "#2b2622"], 0.02);
  p.ditherEll(160, 38, 26, 12, "#7a2a1a");
  p.ell(160, 38, 16, 7, "#d9632a");
  p.ell(160, 38, 12, 5, "#f2b34a");
  p.ell(160, 38, 3, 5, "#0a070a");
  p.px(157, 36, "#fff0b0");
}

export function paintShopPanel(p: Pen): void {
  p.rect(0, 0, 320, 200, "#4a2f14");
  p.rect(0, 0, 320, 2, "#7a5228");
  p.rect(0, 198, 320, 2, "#2a1c0e");
  p.rect(8, 8, 304, 184, "#d8c9a3");
  p.dither(8, 150, 304, 42, "#cfc7b0");
  p.speckle(8, 8, 304, 184, ["#cfc7b0", "#b3a184"], 0.02);
  for (const [x, y] of [[0, 0], [304, 0], [0, 184], [304, 184]] as const) {
    p.rect(x, y, 16, 16, "#55575c");
    p.rect(x, y, 16, 2, "#8a8f96");
    p.px(x + 8, y + 8, "#c0c4c8");
  }
}

export function paintDialoguePanel(p: Pen): void {
  p.rect(0, 0, 320, 80, "#55575c");
  p.rect(0, 0, 320, 2, "#8a8f96");
  p.rect(0, 78, 320, 2, "#1c1d20");
  p.rect(4, 4, 312, 72, "#2a2c30");
  p.dither(4, 4, 312, 72, "#242629");
  p.speckle(4, 4, 312, 72, ["#34373c"], 0.03);
}
