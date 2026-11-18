// Builds contact sheets in out/sheets/ so the whole asset set can be
// reviewed at a glance:
//   processed-<kind>.png   every processed image of a kind, enlarged, with its id
//   candidates-<n>.png     every raw attempt of assets that have more than one, side by side
//
//   node scripts/sheet.ts                 (what "make sheet" runs)
//   node scripts/sheet.ts --only monster  (one kind)

import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { OverlayOptions } from "sharp";
import { parseArgs } from "./lib/args.ts";
import { readRecord } from "./lib/comfy-api.ts";
import { assetDir, rawDir, readManifest } from "./lib/manifest.ts";

const OUT = "out/sheets";
const args = parseArgs(process.argv.slice(2));
if (args.flags["help"]) {
  console.log("usage: node scripts/sheet.ts [--only kind]");
  process.exit(0);
}

function label(text: string, width: number, color = "#d8c9a3"): Buffer {
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return Buffer.from(`<svg width="${width}" height="14" xmlns="http://www.w3.org/2000/svg"><text x="2" y="11" font-family="monospace" font-size="11" fill="${color}">${safe}</text></svg>`);
}

function checker(w: number, h: number): Buffer {
  const data = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = ((x >> 3) + (y >> 3)) % 2 === 0 ? 0x3a : 0x2a;
      data[(y * w + x) * 3] = v;
      data[(y * w + x) * 3 + 1] = v;
      data[(y * w + x) * 3 + 2] = v + 6;
    }
  }
  return data;
}

interface Tile {
  file: string;
  caption: string;
  color?: string;
}

async function sheet(name: string, tiles: Tile[], cell: number, columns: number): Promise<void> {
  if (tiles.length === 0) return;
  const rows = Math.ceil(tiles.length / columns);
  const cw = cell + 8;
  const ch = cell + 22;
  const width = columns * cw;
  const height = rows * ch;
  const layers: OverlayOptions[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i]!;
    const left = (i % columns) * cw + 4;
    const top = Math.floor(i / columns) * ch + 4;
    const meta = await sharp(tile.file).metadata();
    const k = Math.min(cell / (meta.width ?? cell), cell / (meta.height ?? cell));
    const w = Math.max(1, Math.round((meta.width ?? cell) * k));
    const h = Math.max(1, Math.round((meta.height ?? cell) * k));
    const img = await sharp(tile.file).resize(w, h, { kernel: k >= 1 ? "nearest" : "lanczos3", fit: "fill" }).png().toBuffer();
    layers.push({ input: checker(cell, cell), raw: { width: cell, height: cell, channels: 3 }, left, top });
    layers.push({ input: img, left: left + Math.floor((cell - w) / 2), top: top + cell - h });
    layers.push({ input: label(tile.caption, cw - 4, tile.color), left, top: top + cell + 2 });
  }
  const file = path.join(OUT, `${name}.png`);
  await sharp({ create: { width, height, channels: 3, background: "#14110e" } }).composite(layers).png().toFile(file);
  console.log(`sheet: ${file} (${tiles.length} images)`);
}

mkdirSync(OUT, { recursive: true });
if (!args.flags["only"]) for (const f of readdirSync(OUT)) if (f.endsWith(".png")) rmSync(path.join(OUT, f));

const manifest = readManifest();
const kinds = [...new Set(manifest.assets.map((a) => a.kind))].filter((k) => !args.flags["only"] || k === args.flags["only"]);
let total = 0;
for (const kind of kinds) {
  const tiles: Tile[] = [];
  for (const entry of manifest.assets.filter((a) => a.kind === kind)) {
    const file = path.join(assetDir(entry.type), `${entry.id}.png`);
    if (existsSync(file)) tiles.push({ file, caption: entry.id.replace(/^(monster|item)_/, "") });
  }
  total += tiles.length;
  const cell = kind === "icon" ? 96 : kind === "texture" || kind === "decal" || kind === "overlay" ? 128 : kind === "ui" || kind === "portrait" ? 160 : 176;
  await sheet(`processed-${kind}`, tiles, cell, kind === "icon" ? 8 : 6);
}

// Candidates: every attempt of assets that have more than one.
if (!args.flags["only"]) {
  const rows: Tile[] = [];
  for (const entry of manifest.assets) {
    const record = readRecord(rawDir(entry.type), entry.id);
    if (record.attempts.length < 2) continue;
    for (const a of record.attempts) {
      if (!existsSync(a.file)) continue;
      rows.push({ file: a.file, caption: `${entry.id.replace(/^monster_/, "")} a${a.n} ${a.status}`, color: a.status === "kept" ? "#8fd08f" : a.status === "rejected" ? "#e08060" : "#e0c860" });
    }
  }
  const perSheet = 24;
  for (let i = 0; i < rows.length; i += perSheet) await sheet(`candidates-${Math.floor(i / perSheet) + 1}`, rows.slice(i, i + perSheet), 200, 6);
  total += rows.length;
}
console.log(`sheet: ${total} images on sheets in ${OUT}/`);
