// Code-drawn walls, floors, ceilings, doors, and fixtures. Placeholders
// until generated art replaces them, drawn to the same sizes and palette.

import type { Pen } from "./pen.ts";

export interface TierPalette {
  wall: [string, string, string, string, string];
  floor: [string, string, string];
  ceil: [string, string, string];
}

export const TIER_PALETTES: readonly TierPalette[] = [
  { wall: ["#2b2622", "#4a4039", "#6b5d50", "#8c7b66", "#b3a184"], floor: ["#2b2622", "#4a4039", "#5c5046"], ceil: ["#1c1815", "#2b2622", "#3a322c"] },
  { wall: ["#2b2622", "#4a4039", "#6b5d50", "#8c7b66", "#b3a184"], floor: ["#2b2622", "#4a4039", "#5c5046"], ceil: ["#1c1815", "#2b2622", "#3a322c"] },
  { wall: ["#2a1c0e", "#5a3d1e", "#7a5228", "#9a6c36", "#b9853f"], floor: ["#2a1c0e", "#4a3218", "#5e4222"], ceil: ["#1a1108", "#2a1c0e", "#3a2814"] },
  { wall: ["#4a463c", "#7d776a", "#928b7b", "#a39c8a", "#cfc7b0"], floor: ["#3e3b33", "#5f5a50", "#746e62"], ceil: ["#2c2a25", "#3e3b33", "#4d4940"] },
  { wall: ["#10131a", "#1b1f2a", "#2e3546", "#4c566b", "#7a8699"], floor: ["#10131a", "#1f2430", "#2e3546"], ceil: ["#090b10", "#10131a", "#1b1f2a"] },
  { wall: ["#0a070a", "#1a1018", "#2a1620", "#7a2a1a", "#d9632a"], floor: ["#0a070a", "#1a1018", "#2a1620"], ceil: ["#050305", "#0a070a", "#160c14"] },
];

function bricks(p: Pen, pal: TierPalette, bw: number, bh: number): void {
  const [mortar, c1, c2, c3] = pal.wall;
  p.rect(0, 0, 64, 64, mortar);
  for (let row = 0; row * bh < 64; row++) {
    const offset = row % 2 === 0 ? 0 : bw / 2;
    for (let x = -offset; x < 64; x += bw) {
      const color = p.rng.pick([c1, c2, c2, c2, c3]);
      p.rect(x + 1, row * bh + 1, bw - 1, bh - 1, color);
      p.rect(x + 1, row * bh + 1, bw - 1, 1, c3);
      p.dither(x + 1, row * bh + bh - 2, bw - 1, 1, mortar);
    }
  }
  p.speckle(0, 0, 64, 64, [mortar, c1], 0.04);
}

export function paintWall(p: Pen, tier: number): void {
  const pal = TIER_PALETTES[tier] as TierPalette;
  const [c0, c1, c2, c3, c4] = pal.wall;
  if (tier === 1) {
    bricks(p, pal, 16, 8);
    // Damp streaks.
    for (let i = 0; i < 3; i++) p.dither(p.rng.int(60), 0, 2, 20 + p.rng.int(40), c0);
  } else if (tier === 2) {
    p.rect(0, 0, 64, 64, c1);
    for (let i = 0; i < 26; i++) p.ell(p.rng.int(64), p.rng.int(64), 3 + p.rng.int(6), 2 + p.rng.int(4), p.rng.pick([c0, c2, c2, c3]));
    p.speckle(0, 0, 64, 64, [c0, c3, c4], 0.06);
    for (const x of [0, 58]) {
      p.rect(x, 0, 6, 64, "#4a2f14");
      p.rect(x + 1, 0, 1, 64, "#6b4420");
      p.dither(x + 4, 0, 2, 64, "#2a1a0a");
    }
    p.rect(0, 0, 64, 7, "#4a2f14");
    p.rect(0, 1, 64, 1, "#6b4420");
    p.dither(0, 5, 64, 2, "#2a1a0a");
  } else if (tier === 3) {
    bricks(p, pal, 32, 16);
    p.rect(24, 22, 16, 30, c0);
    p.ell(32, 22, 8, 6, c0);
    p.ell(32, 46, 3, 3, c4);
    p.px(31, 45, c0);
    p.px(33, 45, c0);
    p.rect(30, 48, 5, 3, c3);
  } else if (tier === 4) {
    bricks(p, pal, 16, 16);
    for (const y of [14, 46]) {
      p.rect(0, y, 64, 4, c3);
      p.rect(0, y, 64, 1, c4);
      for (let x = 3; x < 64; x += 8) p.px(x, y + 2, c4);
    }
  } else {
    p.rect(0, 0, 64, 64, c1);
    for (let y = 0; y < 64; y += 16) p.rect(0, y, 64, 1, c0);
    for (let x = 8; x < 64; x += 24) p.rect(x, 0, 1, 64, c0);
    p.speckle(0, 0, 64, 64, [c0, c2], 0.08);
    for (let v = 0; v < 5; v++) {
      let x = p.rng.int(64);
      let y = 0;
      while (y < 64) {
        p.px(x, y, c3);
        if (p.rng.chance(0.25)) p.px(x, y, c4);
        y++;
        x = Math.max(0, Math.min(63, x + p.rng.range(-1, 1)));
      }
    }
  }
}

export function paintFloor(p: Pen, tier: number): void {
  const pal = TIER_PALETTES[tier] as TierPalette;
  const [c0, c1, c2] = pal.floor;
  p.rect(0, 0, 64, 64, c1);
  for (let row = 0; row < 2; row++) {
    const offset = row === 0 ? 0 : 16;
    for (let x = -offset; x < 64; x += 32) {
      p.rect(x + 1, row * 32 + 1, 30, 30, p.rng.pick([c1, c1, c2]));
      p.rect(x, row * 32, 32, 1, c0);
      p.rect(x, row * 32, 1, 32, c0);
    }
  }
  p.speckle(0, 0, 64, 64, [c0, c2], 0.07);
  if (tier === 5) p.speckle(0, 0, 64, 64, ["#7a2a1a"], 0.01);
}

export function paintCeil(p: Pen, tier: number): void {
  const pal = TIER_PALETTES[tier] as TierPalette;
  const [c0, c1, c2] = pal.ceil;
  p.rect(0, 0, 64, 64, c1);
  p.speckle(0, 0, 64, 64, [c0, c2], 0.1);
  if (tier === 2 || tier === 1) {
    for (const y of [0, 32]) {
      p.rect(0, y, 64, 6, tier === 2 ? "#3a2412" : c0);
      p.rect(0, y + 1, 64, 1, tier === 2 ? "#553618" : c2);
    }
  } else {
    for (let y = 0; y < 64; y += 32) p.rect(0, y, 64, 1, c0);
    for (let x = 0; x < 64; x += 32) p.rect(x, 0, 1, 64, c0);
  }
}

// ---- doors and gates ---------------------------------------------------

function planks(p: Pen, x0: number, x1: number): void {
  const width = x1 - x0;
  p.rect(x0, 4, width, 60, "#989080");
  const each = Math.max(3, Math.round(width / 5));
  for (let x = x0; x < x1; x += each) {
    p.rect(x, 4, 1, 60, "#3a3530");
    p.rect(x + 1, 4, 1, 60, "#b8b0a0");
    p.dither(x + each - 2, 4, 1, 60, "#807868");
  }
  for (const y of [12, 48]) {
    p.rect(x0, y, width, 5, "#55575c");
    p.rect(x0, y, width, 1, "#8a8f96");
    for (let x = x0 + 2; x < x1; x += 6) p.px(x, y + 2, "#c0c4c8");
  }
}

function lintel(p: Pen): void {
  p.rect(0, 0, 64, 4, "#3a3026");
  p.rect(0, 3, 64, 1, "#1c1712");
}

/** A neutral door, light enough to take a tint for its key colour. */
export function paintDoor(p: Pen, stage: "closed" | "half" | "open"): void {
  lintel(p);
  if (stage === "closed") {
    planks(p, 0, 64);
    p.rect(0, 4, 2, 60, "#3a3026");
    p.rect(62, 4, 2, 60, "#3a3026");
    p.rect(44, 28, 10, 12, "#d8d8d8");
    p.rect(45, 29, 8, 10, "#f0f0f0");
    p.rect(48, 32, 2, 4, "#202020");
    p.ell(48, 24, 3, 3, "#70747a");
    p.ell(48, 24, 1, 1, "#989080");
  } else if (stage === "half") {
    planks(p, 0, 30);
    p.rect(28, 4, 3, 60, "#2a241e");
    p.rect(0, 4, 2, 60, "#3a3026");
  } else {
    p.rect(0, 4, 6, 60, "#807868");
    p.rect(5, 4, 2, 60, "#2a241e");
    p.rect(0, 4, 2, 60, "#3a3026");
  }
}

export function paintGate(p: Pen, open: boolean): void {
  const bar = "#50545a";
  const light = "#8a8f96";
  const bottom = open ? 10 : 64;
  for (let x = 4; x < 64; x += 10) {
    p.rect(x, 0, 4, bottom, bar);
    p.rect(x, 0, 1, bottom, light);
    if (!open) p.tri(x, 60, x + 4, 60, x + 2, 64, bar);
  }
  const rows = open ? [3] : [10, 32, 52];
  for (const y of rows) {
    p.rect(0, y, 64, 4, bar);
    p.rect(0, y, 64, 1, light);
  }
}

export function paintDrawbridge(p: Pen): void {
  p.rect(0, 0, 64, 64, "#5a3d1e");
  for (let x = 0; x < 64; x += 8) {
    p.rect(x, 0, 1, 64, "#2a1c0e");
    p.rect(x + 1, 0, 1, 64, "#7a5228");
  }
  for (const y of [8, 52]) {
    p.rect(0, y, 64, 4, "#50545a");
    p.rect(0, y, 64, 1, "#8a8f96");
  }
  for (const x of [6, 54]) for (let y = 14; y < 50; y += 4) p.rect(x, y, 3, 2, "#8a8f96");
}

export function paintSwitch(p: Pen, state: "off" | "on" | "reset"): void {
  p.rect(22, 18, 20, 28, "#3a3d42");
  p.rect(23, 19, 18, 26, "#55575c");
  p.rect(22, 18, 20, 1, "#8a8f96");
  p.rect(30, 22, 4, 20, "#1c1d20");
  for (const [x, y] of [[24, 20], [39, 20], [24, 43], [39, 43]] as const) p.px(x, y, "#c0c4c8");
  if (state === "reset") {
    p.ell(32, 32, 7, 7, "#8a6a2a");
    p.ell(32, 32, 5, 5, "#c9a23a");
    p.ell(32, 32, 2, 2, "#3a3d42");
    p.line(32, 25, 32, 39, "#3a3d42");
    p.line(25, 32, 39, 32, "#3a3d42");
    return;
  }
  const up = state === "off";
  const knobY = up ? 23 : 41;
  p.line(32, 32, 32, knobY, "#b8b0a0", 2);
  p.ell(32, knobY, 3, 3, up ? "#a03020" : "#40a040");
  p.px(31, knobY - 1, up ? "#e06040" : "#80e080");
}

export function paintTorch(p: Pen, frame: number): void {
  p.rect(30, 34, 4, 14, "#3a2412");
  p.rect(28, 32, 8, 3, "#50545a");
  p.rect(31, 46, 2, 6, "#50545a");
  const sway = frame === 0 ? -1 : 1;
  p.ell(32 + sway, 26, 5, 7, "#d9632a");
  p.ell(32, 27, 3, 5, "#f2b34a");
  p.ell(32 - sway, 28, 1, 3, "#fff0b0");
  p.px(32 + sway * 2, 17 + frame, "#d9632a");
}

// ---- fixtures ----------------------------------------------------------

export function paintStairs(p: Pen, down: boolean): void {
  const stone = "#6b5d50";
  const dark = "#2b2622";
  p.rect(8, 6, 48, 58, dark);
  p.rect(8, 6, 48, 3, stone);
  p.rect(8, 6, 4, 58, stone);
  p.rect(52, 6, 4, 58, stone);
  p.rect(12, 9, 40, 55, "#050505");
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    if (down) {
      const y = 58 - i * 7;
      const inset = 12 + i * 3;
      const shade = ["#8c7b66", "#75675a", "#5c5046", "#443c34", "#2e2924", "#1c1815"][i] as string;
      p.rect(inset, y, 64 - inset * 2, 6, shade);
      p.rect(inset, y, 64 - inset * 2, 1, "#b3a184");
    } else {
      const y = 58 - i * 8;
      const inset = 12 + Math.round(t * 6);
      const shade = ["#443c34", "#5c5046", "#75675a", "#8c7b66", "#a39480", "#c9bca0"][i] as string;
      p.rect(inset, y, 64 - inset * 2, 8, shade);
      p.rect(inset, y, 64 - inset * 2, 1, "#d8cdb4");
    }
  }
  if (!down) p.dither(20, 10, 24, 8, "#c9bca0");
}

export function paintFountain(p: Pen): void {
  p.tri(10, 44, 54, 44, 32, 62, "#4a4039");
  p.rect(10, 40, 44, 6, "#8c7b66");
  p.rect(10, 40, 44, 1, "#b3a184");
  p.rect(14, 46, 36, 10, "#6b5d50");
  p.dither(14, 52, 36, 4, "#2b2622");
  p.rect(13, 41, 38, 3, "#3a6ac0");
  p.dither(13, 42, 38, 1, "#9fd8e8");
  p.rect(30, 18, 4, 24, "#8c7b66");
  p.ell(32, 18, 5, 3, "#b3a184");
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const x = 32 + side * (2 + i);
      const y = 16 + Math.round((i * i) / 6);
      p.px(x, y, "#9fd8e8");
      if (i % 2 === 0) p.px(x, y + 1, "#3a6ac0");
    }
  }
  p.px(32, 12, "#9fd8e8");
  p.px(32, 14, "#ffffff");
}

export function paintAltar(p: Pen): void {
  p.rect(12, 34, 40, 6, "#b3a184");
  p.rect(12, 34, 40, 1, "#e4dcc6");
  p.rect(16, 40, 32, 18, "#8c7b66");
  p.dither(16, 50, 32, 8, "#4a4039");
  p.rect(12, 58, 40, 4, "#6b5d50");
  p.rect(22, 34, 20, 14, "#7a1f1f");
  p.rect(22, 34, 20, 1, "#c03a2a");
  p.rect(30, 38, 4, 6, "#e0b040");
  for (const x of [16, 46]) {
    p.rect(x, 24, 2, 10, "#e4dcc6");
    p.ell(x + 1, 21, 1, 2, "#f2b34a");
    p.px(x + 1, 19, "#fff0b0");
  }
}

export function paintStatue(p: Pen): void {
  const a = "#7d776a";
  const b = "#a39c8a";
  const c = "#4a463c";
  p.rect(18, 54, 28, 8, a);
  p.rect(18, 54, 28, 1, b);
  p.dither(18, 59, 28, 3, c);
  p.rect(26, 34, 5, 20, a);
  p.rect(33, 34, 5, 20, a);
  p.rect(24, 18, 16, 18, a);
  p.ditherEll(36, 28, 5, 9, c);
  p.rect(20, 18, 4, 14, a);
  p.rect(40, 12, 4, 16, a);
  p.ell(32, 12, 5, 6, b);
  p.dither(33, 10, 4, 8, a);
  p.px(30, 11, c);
  p.px(33, 11, c);
}

export function paintBoulder(p: Pen): void {
  p.ell(32, 40, 24, 22, "#6b5d50");
  p.ell(28, 34, 16, 13, "#8c7b66");
  p.ell(24, 30, 6, 4, "#b3a184");
  p.ditherEll(38, 48, 18, 13, "#4a4039");
  p.line(30, 24, 36, 38, "#2b2622");
  p.line(36, 38, 33, 50, "#2b2622");
  p.line(44, 30, 48, 42, "#2b2622");
}

/** A floor plate seen from above; drawn squashed onto the floor in the view. */
export function paintPlate(p: Pen): void {
  p.rect(2, 2, 28, 28, "#3a3d42");
  p.rect(4, 4, 24, 24, "#8a6a2a");
  p.rect(4, 4, 24, 2, "#c9a23a");
  p.rect(4, 4, 2, 24, "#c9a23a");
  p.dither(6, 6, 20, 20, "#6a5020");
  p.rect(14, 14, 4, 4, "#3a3d42");
}

export function paintTrapMark(p: Pen): void {
  p.rect(4, 4, 24, 24, "#2b2622");
  p.line(6, 6, 25, 25, "#c03a2a", 2);
  p.line(25, 6, 6, 25, "#c03a2a", 2);
}

export function paintChest(p: Pen, open: boolean): void {
  p.rect(10, 34, 44, 26, "#5a3d1e");
  p.rect(10, 34, 44, 2, "#8a5a2b");
  p.dither(32, 36, 22, 24, "#2a1c0e");
  for (const x of [10, 30, 50]) p.rect(x, 34, 4, 26, "#50545a");
  p.rect(10, 58, 44, 2, "#2a1c0e");
  if (open) {
    p.rect(12, 12, 40, 20, "#4a2f14");
    p.rect(12, 12, 40, 2, "#8a5a2b");
    p.rect(14, 30, 36, 6, "#0a0705");
    for (const x of [12, 30, 48]) p.rect(x, 12, 4, 20, "#50545a");
  } else {
    p.ell(32, 34, 22, 8, "#7a5228");
    p.rect(10, 30, 44, 6, "#7a5228");
    p.rect(10, 30, 44, 1, "#b9853f");
    p.rect(28, 36, 8, 8, "#c9a23a");
    p.rect(31, 39, 2, 3, "#14110e");
  }
}

export function paintGrave(p: Pen): void {
  p.ell(32, 58, 22, 5, "#4a3218");
  p.dither(12, 56, 40, 5, "#2a1c0e");
  p.rect(20, 26, 24, 32, "#7d776a");
  p.ell(32, 26, 12, 10, "#7d776a");
  p.ditherEll(36, 30, 8, 9, "#4a463c");
  p.dither(34, 30, 10, 28, "#4a463c");
  p.rect(20, 26, 1, 32, "#a39c8a");
  for (const y of [30, 35, 40]) p.rect(25, y, 14 - (y % 3) * 2, 1, "#2c2a25");
}
