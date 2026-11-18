// Code-drawn monsters and characters, 64x64, in two frames each: idle
// and attack. A handful of body plans cover the whole roster.

import type { Pen } from "./pen.ts";

type Weapon = "none" | "club" | "sword" | "dagger" | "axe" | "staff";
type Hat = "none" | "helm" | "horns" | "hat" | "hood" | "snakes" | "crown";

interface Humanoid {
  plan: "humanoid";
  /** Height in pixels of the whole figure, 30 to 60. */
  height: number;
  width: number;
  skin: string;
  cloth: string;
  dark: string;
  eye: string;
  weapon: Weapon;
  hat: Hat;
  robe?: boolean;
  beard?: string;
  shield?: string;
  hunched?: boolean;
  /** Calm stance with open hands: peaceful characters. */
  calm?: boolean;
  cape?: string;
}

interface Beast {
  plan: "lizard" | "dog" | "eye" | "bat" | "blob" | "insect" | "bird" | "ghost" | "dragon" | "snake";
  body: string;
  dark: string;
  light: string;
  eye: string;
}

export type Look = Humanoid | Beast;

export const MONSTER_LOOKS: Record<string, Look> = {
  newt: { plan: "lizard", body: "#b9853f", dark: "#5a3d1e", light: "#e0b040", eye: "#101010" },
  jackal: { plan: "dog", body: "#a08050", dark: "#5a4020", light: "#d0b080", eye: "#f0e060" },
  kobold: { plan: "humanoid", height: 34, width: 14, skin: "#a04a30", cloth: "#5a3d1e", dark: "#3a1810", eye: "#f0e060", weapon: "dagger", hat: "none" },
  floating_eye: { plan: "eye", body: "#3a6ac0", dark: "#1a2a60", light: "#e8e8f0", eye: "#101030" },
  giant_bat: { plan: "bat", body: "#4a3020", dark: "#20140c", light: "#7a5a40", eye: "#f04030" },
  acid_blob: { plan: "blob", body: "#6f9a2a", dark: "#3a5a10", light: "#c0e060", eye: "#203000" },
  hill_orc: { plan: "humanoid", height: 46, width: 20, skin: "#6a7a4a", cloth: "#4a3a2a", dark: "#2a3018", eye: "#f04030", weapon: "club", hat: "none" },
  dwarf: { plan: "humanoid", height: 36, width: 22, skin: "#c09070", cloth: "#5a4a6a", dark: "#2a2030", eye: "#101010", weapon: "axe", hat: "helm", beard: "#a05a20" },
  soldier_ant: { plan: "insect", body: "#7a1f1f", dark: "#3a0c0c", light: "#c03a2a", eye: "#101010" },
  cockatrice: { plan: "bird", body: "#c9a23a", dark: "#4a7a2a", light: "#f0e080", eye: "#c03a2a" },
  ghoul: { plan: "humanoid", height: 46, width: 18, skin: "#8a9a7a", cloth: "#3a3a30", dark: "#2a3024", eye: "#e0e060", weapon: "none", hat: "none", hunched: true },
  leprechaun: { plan: "humanoid", height: 30, width: 14, skin: "#e0b090", cloth: "#2a7a3a", dark: "#103a18", eye: "#101010", weapon: "none", hat: "hat", beard: "#c05a20" },
  troll: { plan: "humanoid", height: 58, width: 26, skin: "#5a6a3a", cloth: "#3a2a1a", dark: "#2a3418", eye: "#f0e060", weapon: "club", hat: "none", hunched: true },
  wraith: { plan: "ghost", body: "#3a3a48", dark: "#14141c", light: "#7a7a90", eye: "#c03a2a" },
  stalker: { plan: "ghost", body: "#9ab0c0", dark: "#607080", light: "#e0f0ff", eye: "#ffffff" },
  ogre: { plan: "humanoid", height: 60, width: 30, skin: "#b08a5a", cloth: "#5a3a2a", dark: "#4a3018", eye: "#101010", weapon: "club", hat: "none" },
  vampire: { plan: "humanoid", height: 54, width: 18, skin: "#d8d0c8", cloth: "#1c1820", dark: "#0a080c", eye: "#f02020", weapon: "none", hat: "none", robe: true, cape: "#7a1f1f" },
  minotaur: { plan: "humanoid", height: 60, width: 28, skin: "#6a4a2a", cloth: "#3a2a1a", dark: "#2a1a0c", eye: "#f04030", weapon: "axe", hat: "horns" },
  fire_drake: { plan: "dragon", body: "#a02a1a", dark: "#4a0c08", light: "#f08030", eye: "#f0e060" },
  lich: { plan: "humanoid", height: 54, width: 18, skin: "#d8d2bd", cloth: "#3a2050", dark: "#1a0c28", eye: "#60f0f0", weapon: "staff", hat: "crown", robe: true },
  water_snake: { plan: "snake", body: "#2a7a6a", dark: "#103a30", light: "#80d0b0", eye: "#f0e060" },
  soldier: { plan: "humanoid", height: 52, width: 20, skin: "#c09070", cloth: "#6a7078", dark: "#2a2e34", eye: "#101010", weapon: "sword", hat: "helm", shield: "#7a1f1f" },
  medusa: { plan: "humanoid", height: 54, width: 18, skin: "#8ab08a", cloth: "#4a6a4a", dark: "#1a3020", eye: "#f0f040", weapon: "none", hat: "snakes", robe: true },
  morvane: { plan: "humanoid", height: 58, width: 20, skin: "#b0a090", cloth: "#2a1620", dark: "#0a070a", eye: "#d9632a", weapon: "staff", hat: "hood", robe: true, cape: "#7a2a1a" },
  shopkeeper: { plan: "humanoid", height: 50, width: 24, skin: "#e0b090", cloth: "#8a5a2b", dark: "#5a3d1e", eye: "#101010", weapon: "none", hat: "none", calm: true, beard: "#6a4030" },
  priest: { plan: "humanoid", height: 54, width: 18, skin: "#e0c8b0", cloth: "#e4dcc6", dark: "#a39c8a", eye: "#101010", weapon: "none", hat: "hood", robe: true, calm: true },
  hermit: { plan: "humanoid", height: 48, width: 18, skin: "#d8c0a0", cloth: "#7a5a3a", dark: "#4a3420", eye: "#101010", weapon: "staff", hat: "hood", robe: true, calm: true, beard: "#d8d2bd", hunched: true },
  adventurer: { plan: "humanoid", height: 52, width: 20, skin: "#d0a080", cloth: "#6a7a5a", dark: "#3a4430", eye: "#101010", weapon: "none", hat: "none", calm: true },
  gnome: { plan: "humanoid", height: 30, width: 16, skin: "#e0b090", cloth: "#3a6ac0", dark: "#1a2a60", eye: "#101010", weapon: "none", hat: "hat", calm: true, beard: "#f4f4f4" },
  oracle: { plan: "humanoid", height: 54, width: 18, skin: "#e0c8b0", cloth: "#c8d8e8", dark: "#7a8aa0", eye: "#3a6ac0", weapon: "none", hat: "hood", robe: true, calm: true },
};

function humanoid(p: Pen, L: Humanoid, attack: boolean): void {
  const cx = 32;
  const feet = 62;
  const h = L.height;
  const w = L.width;
  const headR = Math.max(4, Math.round(h * 0.11));
  const top = feet - h;
  const headY = top + headR + (L.hunched ? 4 : 0);
  const shoulderY = headY + headR + 1;
  const hipY = feet - Math.round(h * 0.38);
  const lean = attack ? 2 : 0;

  if (L.cape) {
    p.tri(cx - w / 2 - 3, shoulderY, cx + w / 2 + 3, shoulderY, cx - w / 2 - 7, feet - 2, L.cape);
    p.tri(cx - w / 2 - 3, shoulderY, cx + w / 2 + 3, shoulderY, cx + w / 2 + 7, feet - 2, L.cape);
  }
  // Legs or robe.
  if (L.robe) {
    p.tri(cx - w / 2, shoulderY, cx + w / 2, shoulderY, cx - w / 2 - 4, feet, L.cloth);
    p.tri(cx - w / 2, shoulderY, cx + w / 2, shoulderY, cx + w / 2 + 4, feet, L.cloth);
    p.rect(cx - w / 2 - 3, hipY, w + 6, feet - hipY, L.cloth);
    p.dither(cx + 1, shoulderY + 2, w / 2 + 2, feet - shoulderY - 2, L.dark);
    p.rect(cx - w / 2 - 4, feet - 1, w + 8, 1, L.dark);
  } else {
    const legW = Math.max(3, Math.round(w * 0.32));
    p.rect(cx - w / 2 + 1, hipY, legW, feet - hipY, L.cloth);
    p.rect(cx + w / 2 - legW - 1, hipY, legW, feet - hipY, L.cloth);
    p.dither(cx + w / 2 - legW - 1, hipY, legW, feet - hipY, L.dark);
    p.rect(cx - w / 2, feet - 2, legW + 2, 2, L.dark);
    p.rect(cx + w / 2 - legW - 2, feet - 2, legW + 2, 2, L.dark);
    // Torso.
    p.rect(cx - w / 2, shoulderY, w, hipY - shoulderY + 2, L.cloth);
    p.rect(cx - w / 2, shoulderY, w, 2, L.skin);
    p.dither(cx, shoulderY + 2, w / 2, hipY - shoulderY, L.dark);
    p.rect(cx - w / 2, hipY - 1, w, 2, L.dark);
  }
  // Arms.
  const armW = Math.max(3, Math.round(w * 0.24));
  const armLen = Math.round(h * 0.34);
  const leftX = cx - w / 2 - armW;
  const rightX = cx + w / 2;
  if (L.calm) {
    p.rect(leftX, shoulderY + 2, armW, armLen - 4, L.cloth);
    p.rect(rightX, shoulderY + 2, armW, armLen - 4, L.cloth);
    p.rect(leftX - 2, shoulderY + armLen - 4, armW + 2, 3, L.skin);
    p.rect(rightX, shoulderY + armLen - 4, armW + 2, 3, L.skin);
  } else if (attack) {
    p.rect(leftX, shoulderY - armLen + 4, armW, armLen, L.skin);
    p.rect(rightX, shoulderY - armLen + 4, armW, armLen, L.skin);
  } else {
    p.rect(leftX, shoulderY + 1, armW, armLen, L.skin);
    p.rect(rightX, shoulderY + 1, armW, armLen, L.skin);
    p.dither(rightX, shoulderY + 1, armW, armLen, L.dark);
  }
  const handX = rightX + Math.floor(armW / 2);
  const handY = attack ? shoulderY - armLen + 4 : shoulderY + armLen;
  // Weapon in the right hand.
  if (L.weapon === "club") {
    const y0 = attack ? handY - 16 : handY - 14;
    p.rect(handX - 1, y0, 3, 20, "#5a3d1e");
    p.ell(handX, y0, 4, 5, "#7a5228");
    p.px(handX - 2, y0 - 2, "#b9853f");
  } else if (L.weapon === "sword" || L.weapon === "dagger") {
    const len = L.weapon === "sword" ? 22 : 10;
    const y0 = attack ? handY - len : handY - len + 4;
    p.rect(handX, y0, 2, len, "#c0c4c8");
    p.rect(handX, y0, 1, len, "#f0f0f0");
    p.rect(handX - 2, y0 + len, 6, 2, "#8a6a2a");
  } else if (L.weapon === "axe") {
    const y0 = attack ? handY - 20 : handY - 16;
    p.rect(handX, y0, 2, 24, "#5a3d1e");
    p.tri(handX + 2, y0, handX + 2, y0 + 10, handX + 9, y0 + 5, "#8a8f96");
    p.tri(handX, y0, handX, y0 + 10, handX - 7, y0 + 5, "#c0c4c8");
  } else if (L.weapon === "staff") {
    const y0 = top - 2 - (attack ? 4 : 0);
    p.rect(handX, y0, 2, feet - y0, "#5a3d1e");
    p.ell(handX + 1, y0, 3, 3, L.eye);
    p.px(handX, y0 - 1, "#ffffff");
  }
  if (L.shield) {
    p.ell(leftX + 1, shoulderY + 12, 6, 8, L.shield);
    p.ell(leftX + 1, shoulderY + 12, 4, 6, "#8a8f96");
    p.px(leftX + 1, shoulderY + 12, "#f0f0f0");
  }
  // Head.
  const hx = cx + (L.hunched ? 2 : 0) + lean;
  p.ell(hx, headY, headR, headR + 1, L.skin);
  p.ditherEll(hx + 2, headY + 1, headR - 1, headR, L.dark);
  p.px(hx - 2, headY - 1, L.eye);
  p.px(hx + 2, headY - 1, L.eye);
  if (attack) p.rect(hx - 2, headY + 2, 4, 2, "#200808");
  else p.rect(hx - 1, headY + 3, 3, 1, L.dark);
  if (L.beard) {
    p.tri(hx - headR, headY + 1, hx + headR, headY + 1, hx, headY + headR + 7, L.beard);
    p.px(hx - 2, headY - 1, L.eye);
    p.px(hx + 2, headY - 1, L.eye);
  }
  switch (L.hat) {
    case "helm":
      p.ell(hx, headY - 2, headR + 1, headR - 1, "#8a8f96");
      p.rect(hx - headR - 1, headY - 2, headR * 2 + 2, 2, "#50545a");
      p.rect(hx, headY - 2, 1, 4, "#50545a");
      break;
    case "horns":
      p.tri(hx - headR, headY - 2, hx - headR - 7, headY - 9, hx - headR - 1, headY + 1, "#e4dcc6");
      p.tri(hx + headR, headY - 2, hx + headR + 7, headY - 9, hx + headR + 1, headY + 1, "#e4dcc6");
      break;
    case "hat":
      p.rect(hx - headR - 2, headY - headR, headR * 2 + 4, 2, "#103a18");
      p.rect(hx - headR + 1, headY - headR - 6, headR * 2 - 2, 6, "#2a7a3a");
      p.rect(hx - headR + 1, headY - headR - 2, headR * 2 - 2, 1, "#e0b040");
      break;
    case "hood":
      p.ell(hx, headY - 1, headR + 2, headR + 2, L.cloth);
      p.ell(hx, headY + 1, headR - 1, headR - 1, L.skin);
      p.ditherEll(hx + 1, headY + 1, headR - 2, headR - 1, L.dark);
      p.px(hx - 2, headY, L.eye);
      p.px(hx + 2, headY, L.eye);
      break;
    case "snakes":
      for (let i = -3; i <= 3; i++) {
        const sx = hx + i * 2;
        const len = 5 + ((i + 3) % 3) * 2 + (attack ? 2 : 0);
        p.line(sx, headY - headR + 1, sx + i, headY - headR - len, "#2a7a3a");
        p.px(sx + i, headY - headR - len, "#f0e060");
      }
      break;
    case "crown":
      p.rect(hx - headR, headY - headR - 2, headR * 2, 3, "#c9a23a");
      for (let i = -headR; i < headR; i += 3) p.px(hx + i, headY - headR - 3, "#e0b040");
      break;
    default:
      break;
  }
}

function beast(p: Pen, L: Beast, attack: boolean): void {
  const { body, dark, light, eye } = L;
  switch (L.plan) {
    case "lizard":
      p.ell(32, 54, 12, 4, body);
      p.ditherEll(34, 56, 10, 2, dark);
      p.tri(42, 52, 42, 56, 58, 58, body);
      p.ell(20, 52, 5, 3, light);
      p.px(18, 51, eye);
      for (const x of [24, 30, 36, 40]) p.rect(x, 57, 2, 3, dark);
      if (attack) p.rect(13, 53, 4, 1, "#c03a2a");
      break;
    case "dog":
      p.ell(34, 44, 14, 7, body);
      p.ditherEll(36, 47, 12, 4, dark);
      for (const x of [23, 28, 40, 45]) p.rect(x, 48, 3, 13, body);
      p.rect(40, 48, 3, 13, dark);
      p.tri(46, 40, 48, 44, 58, 34, body);
      p.ell(20, attack ? 38 : 36, 7, 6, body);
      p.tri(14, 31, 17, 24, 20, 31, body);
      p.tri(21, 31, 24, 24, 27, 31, dark);
      p.tri(13, 38, 13, 42, 6, 41, light);
      p.px(17, 35, eye);
      p.px(22, 35, eye);
      if (attack) {
        p.rect(7, 42, 8, 2, "#200808");
        p.px(8, 42, "#ffffff");
        p.px(11, 42, "#ffffff");
      }
      break;
    case "eye":
      p.ell(32, 30, 16, 16, body);
      p.ditherEll(36, 34, 13, 12, dark);
      p.ell(32, 30, 10, attack ? 10 : 8, light);
      p.ell(32, 30, 5, 5, "#3a8a9a");
      p.ell(32, 30, 2, 3, eye);
      p.px(30, 28, "#ffffff");
      for (let i = 0; i < 5; i++) p.line(22 + i * 5, 46, 21 + i * 5 + (i % 2 ? 2 : -2), 54 + (i % 3), dark);
      break;
    case "bat": {
      const flap = attack ? -8 : 0;
      p.ell(32, 30, 6, 8, body);
      p.tri(27, 26, 6, 18 + flap, 14, 38, body);
      p.tri(37, 26, 58, 18 + flap, 50, 38, body);
      p.tri(27, 30, 14, 38, 24, 36, dark);
      p.tri(37, 30, 50, 38, 40, 36, dark);
      p.tri(28, 23, 29, 17, 31, 23, body);
      p.tri(33, 23, 35, 17, 36, 23, body);
      p.px(30, 27, eye);
      p.px(34, 27, eye);
      if (attack) p.rect(30, 31, 5, 2, "#ffffff");
      break;
    }
    case "blob":
      p.ell(32, 52, attack ? 20 : 17, attack ? 8 : 10, body);
      p.ell(28, 48, 9, 5, light);
      p.ditherEll(36, 55, 14, 5, dark);
      p.ell(40, 50, 2, 2, eye);
      p.ell(22, 54, 1, 1, light);
      for (let i = 0; i < 4; i++) p.px(18 + i * 9, 61, dark);
      break;
    case "insect":
      p.ell(42, 48, 10, 7, body);
      p.ell(28, 46, 6, 5, dark);
      p.ell(18, attack ? 42 : 44, 6, 5, body);
      p.ditherEll(44, 50, 8, 4, dark);
      for (let i = 0; i < 3; i++) {
        p.line(26 + i * 6, 50, 20 + i * 8, 60, dark);
        p.line(28 + i * 6, 44, 24 + i * 8, 36, dark);
      }
      p.line(14, 40, 8, 32, dark);
      p.line(18, 39, 16, 30, dark);
      p.px(15, 43, eye);
      p.tri(12, 46, 12, 49, attack ? 4 : 7, 48, light);
      break;
    case "bird":
      p.ell(34, 46, 10, 9, body);
      p.ditherEll(37, 49, 8, 6, dark);
      p.line(46, 44, 58, 52, dark, 3);
      p.tri(56, 50, 62, 50, 59, 58, dark);
      p.ell(22, attack ? 34 : 32, 5, 5, body);
      p.tri(18, 27, 22, 22, 26, 27, "#c03a2a");
      p.tri(17, 33, 17, 36, attack ? 8 : 11, 35, "#f08030");
      p.px(21, 31, eye);
      p.rect(30, 54, 2, 7, "#f08030");
      p.rect(37, 54, 2, 7, "#f08030");
      p.rect(28, 60, 5, 1, "#f08030");
      p.rect(35, 60, 5, 1, "#f08030");
      break;
    case "ghost":
      p.ell(32, 24, 12, 13, body);
      p.rect(20, 24, 24, 30, body);
      for (let i = 0; i < 4; i++) p.tri(20 + i * 6, 54, 26 + i * 6, 54, 23 + i * 6, attack ? 62 : 60, body);
      p.dither(32, 14, 12, 40, dark);
      p.ell(27, 22, 2, 3, eye);
      p.ell(37, 22, 2, 3, eye);
      p.ditherEll(26, 20, 6, 6, light);
      if (attack) {
        p.rect(27, 30, 10, 5, dark);
        p.rect(10, 30, 10, 4, body);
        p.rect(44, 30, 10, 4, body);
      } else {
        p.rect(28, 31, 8, 2, dark);
      }
      break;
    case "dragon":
      p.ell(34, 44, 16, 11, body);
      p.ditherEll(37, 48, 13, 7, dark);
      p.tri(18, 36, 50, 36, 30, 8, dark);
      p.tri(24, 36, 46, 36, 34, 14, body);
      p.tri(46, 44, 46, 52, 62, 58, body);
      for (const x of [24, 42]) p.rect(x, 52, 5, 9, body);
      p.rect(22, 60, 8, 2, dark);
      p.rect(40, 60, 8, 2, dark);
      p.line(22, 40, 14, attack ? 26 : 30, body, 5);
      p.ell(11, attack ? 24 : 28, 7, 5, body);
      p.tri(6, 24, 9, 16, 12, 24, light);
      p.px(10, attack ? 22 : 26, eye);
      if (attack) {
        p.tri(4, 26, 4, 30, -2, 36, light);
        p.rect(3, 27, 6, 2, "#f2b34a");
      }
      for (let i = 0; i < 5; i++) p.px(28 + i * 4, 34, light);
      break;
    case "snake":
      for (let i = 0; i < 26; i++) {
        const x = 46 - i * 1.2;
        const y = 58 - Math.abs(Math.sin(i / 3)) * 5 - (i > 16 ? (i - 16) * 2.2 : 0);
        p.ell(x, y, 3, 3, i % 4 < 2 ? body : dark);
      }
      p.ell(14, attack ? 30 : 34, 4, 3, body);
      p.px(12, attack ? 29 : 33, eye);
      p.line(10, attack ? 31 : 35, 5, attack ? 33 : 36, "#c03a2a");
      p.ditherEll(30, 58, 14, 2, light);
      break;
  }
}

export function paintMonster(p: Pen, id: string, attack: boolean): void {
  const look = MONSTER_LOOKS[id];
  if (!look) return;
  if (look.plan === "humanoid") humanoid(p, look, attack);
  else beast(p, look, attack);
}

/** A 48x48 bust for the character panel. */
export function paintPortrait(p: Pen, role: string): void {
  p.rect(0, 0, 48, 48, "#1c1815");
  p.dither(0, 0, 48, 48, "#2b2622");
  if (role === "valkyrie") {
    p.rect(10, 34, 28, 14, "#6a7078");
    p.rect(10, 34, 28, 2, "#c0c4c8");
    p.ell(24, 22, 10, 12, "#e0b090");
    p.ditherEll(27, 24, 7, 9, "#b98a6a");
    p.rect(12, 22, 4, 20, "#e0b040");
    p.rect(32, 22, 4, 20, "#e0b040");
    p.ell(24, 13, 11, 6, "#8a8f96");
    p.rect(13, 14, 22, 2, "#50545a");
    p.tri(12, 12, 6, 2, 16, 10, "#e4dcc6");
    p.tri(36, 12, 42, 2, 32, 10, "#e4dcc6");
    p.px(20, 22, "#3a6ac0");
    p.px(28, 22, "#3a6ac0");
    p.rect(22, 29, 5, 1, "#7a1f1f");
  } else if (role === "wizard") {
    p.rect(8, 36, 32, 12, "#3a2050");
    p.ell(24, 24, 9, 11, "#d8c0a0");
    p.ditherEll(27, 26, 6, 8, "#a08868");
    p.tri(14, 28, 34, 28, 24, 46, "#d8d2bd");
    p.tri(10, 18, 38, 18, 24, -6, "#3a2050");
    p.rect(9, 17, 30, 3, "#2a1640");
    p.px(22, 6, "#e0b040");
    p.px(26, 10, "#e0b040");
    p.px(20, 23, "#101010");
    p.px(28, 23, "#101010");
  } else {
    p.rect(8, 36, 32, 12, "#3a3a30");
    p.ell(24, 24, 9, 11, "#c8a080");
    p.ditherEll(27, 26, 6, 8, "#8a6a50");
    p.ell(24, 16, 12, 9, "#2a2a24");
    p.ell(24, 23, 8, 8, "#c8a080");
    p.rect(14, 28, 20, 8, "#5a2a2a");
    p.dither(14, 28, 20, 8, "#3a1818");
    p.px(20, 22, "#3f9a4a");
    p.px(28, 22, "#3f9a4a");
  }
  p.rect(0, 0, 48, 1, "#8c7b66");
  p.rect(0, 47, 48, 1, "#2b2622");
  p.rect(0, 0, 1, 48, "#8c7b66");
  p.rect(47, 0, 1, 48, "#2b2622");
}
