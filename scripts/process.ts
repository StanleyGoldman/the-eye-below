// Post-processes one raw or cutout file into the asset the game loads:
// transparency clean-up, crop, nearest-neighbour downscale to the
// manifest size, and quantizing to the shared palette with ordered
// dithering. Writes what it did into the asset's generation record.
//
//   node scripts/process.ts --id monster_newt
//
// All of this happens at build time; the game never reads pixels.

import { existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fail, parseArgs } from "./lib/args.ts";
import { readRecord, writeRecord } from "./lib/comfy-api.ts";
import { PROMPTS_FILE, assetDir, entryOf, rawDir, readManifest, readPrompts } from "./lib/manifest.ts";

const ALPHA_THRESHOLD = 128;
// Kept tight: the generated "magenta" is closer to crimson, and red monsters must survive it.
const KEY_TOLERANCE = 30;
const DITHER = 9;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const args = parseArgs(process.argv.slice(2));
if (args.flags["help"] || !args.flags["id"]) {
  console.log("usage: node scripts/process.ts --id asset");
  process.exit(args.flags["help"] ? 0 : 1);
}
const id = args.flags["id"] as string;

interface Raw {
  data: Buffer;
  w: number;
  h: number;
}

async function load(file: string): Promise<Raw> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** The background colour: the average of the four corners of the uncut image. */
function cornerColor(img: Raw): [number, number, number] {
  const sum = [0, 0, 0];
  let n = 0;
  const size = Math.max(4, Math.floor(img.w / 40));
  for (const [cx, cy] of [[0, 0], [img.w - size, 0], [0, img.h - size], [img.w - size, img.h - size]] as const) {
    for (let y = cy; y < cy + size; y++) {
      for (let x = cx; x < cx + size; x++) {
        const i = (y * img.w + x) * 4;
        sum[0]! += img.data[i]!;
        sum[1]! += img.data[i + 1]!;
        sum[2]! += img.data[i + 2]!;
        n++;
      }
    }
  }
  return [Math.round(sum[0]! / n), Math.round(sum[1]! / n), Math.round(sum[2]! / n)];
}

/**
 * Is this pixel background? Either close to the measured background
 * colour, or a pink-purple blend of it with the subject's edge, which
 * is what the fringe around a cutout is made of.
 */
function near(img: Raw, i: number, key: [number, number, number]): boolean {
  const r = img.data[i]!;
  const g = img.data[i + 1]!;
  const b = img.data[i + 2]!;
  const dr = r - key[0];
  const dg = g - key[1];
  const db = b - key[2];
  if (Math.sqrt(dr * dr + dg * dg + db * db) < KEY_TOLERANCE) return true;
  const keyIsMagenta = key[0] > key[1] + 60 && key[2] > key[1] + 20;
  return keyIsMagenta && r > g + 40 && b > g + 22 && r > 70;
}

/** Remove background-coloured pixels: everywhere ("all"), or only those connected to what is already transparent ("edge"). */
function keyOut(img: Raw, key: [number, number, number], mode: "all" | "edge"): number {
  let removed = 0;
  if (mode === "all") {
    for (let p = 0; p < img.w * img.h; p++) {
      if (img.data[p * 4 + 3]! > 0 && near(img, p * 4, key)) {
        img.data[p * 4 + 3] = 0;
        removed++;
      }
    }
    return removed;
  }
  const queue: number[] = [];
  for (let p = 0; p < img.w * img.h; p++) if (img.data[p * 4 + 3] === 0) queue.push(p);
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head]!;
    const x = p % img.w;
    const y = (p - x) / img.w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h) continue;
      const q = ny * img.w + nx;
      if (img.data[q * 4 + 3] === 0 || !near(img, q * 4, key)) continue;
      img.data[q * 4 + 3] = 0;
      removed++;
      queue.push(q);
    }
  }
  return removed;
}

function bounds(img: Raw): [number, number, number, number] | null {
  let x0 = img.w;
  let y0 = img.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.data[(y * img.w + x) * 4 + 3]! === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

function parsePalette(list: string[]): [number, number, number][] {
  return list.map((hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
}

/** Map every opaque pixel to the shared palette, with a 4x4 ordered dither. Returns the number of colours used. */
function quantize(img: Raw, palette: [number, number, number][]): number {
  const used = new Set<number>();
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const i = (y * img.w + x) * 4;
      if (img.data[i + 3]! === 0) {
        img.data[i] = 0;
        img.data[i + 1] = 0;
        img.data[i + 2] = 0;
        continue;
      }
      const t = ((BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16 - 0.5) * 2 * DITHER;
      const r = img.data[i]! + t;
      const g = img.data[i + 1]! + t;
      const b = img.data[i + 2]! + t;
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k < palette.length; k++) {
        const c = palette[k]!;
        const d = 2 * (r - c[0]) ** 2 + 4 * (g - c[1]) ** 2 + 3 * (b - c[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      const c = palette[best]!;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
      used.add(best);
    }
  }
  return used.size;
}

async function scaled(img: Raw, w: number, h: number): Promise<Raw> {
  const data = await sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } }).resize(w, h, { kernel: "nearest", fit: "fill" }).raw().toBuffer();
  return { data, w, h };
}

function cropped(img: Raw, box: [number, number, number, number]): Raw {
  const [bx, by, bw, bh] = box;
  const data = Buffer.alloc(bw * bh * 4);
  for (let y = 0; y < bh; y++) img.data.copy(data, y * bw * 4, ((by + y) * img.w + bx) * 4, ((by + y) * img.w + bx + bw) * 4);
  return { data, w: bw, h: bh };
}

try {
  const entry = entryOf(readManifest(), id);
  if (entry.type !== "image" && entry.type !== "frame") fail(`${id} is not an image; audio is processed in a later release`);
  const dir = rawDir(entry.type);
  const record = readRecord(dir, id);
  if (record.fallback) {
    console.log(`process: ${id} is a recorded fallback; the game uses its code-drawn art`);
    process.exit(0);
  }
  const rawFile = path.join(dir, `${id}.png`);
  const cutFile = path.join(dir, `${id}.cut.png`);
  const keyMode = entry.key ?? "edge";
  // A grid of bars is keyed from the uncut image: background removal tends to keep or drop the whole thing.
  const useCut = entry.transparent && keyMode !== "all";
  const input = useCut ? cutFile : rawFile;
  if (!existsSync(input)) fail(`${input} does not exist; generate it first`);
  const [tw, th] = entry.size;
  let img = await load(input);
  let crop: [number, number, number, number] = [0, 0, img.w, img.h];
  let removed = 0;
  let key: [number, number, number] | null = null;

  if (entry.transparent) {
    key = cornerColor(await load(rawFile));
    for (let p = 0; p < img.w * img.h; p++) img.data[p * 4 + 3] = img.data[p * 4 + 3]! >= ALPHA_THRESHOLD ? 255 : 0;
    removed = keyOut(img, key, keyMode);
    const b = bounds(img);
    if (!b) fail(`${id}: nothing is left after removing the background`);
    crop = b;
    img = cropped(img, b);
  }

  const out: Raw = { data: Buffer.alloc(tw * th * 4), w: tw, h: th };
  const fit = entry.fit ?? "bottom";
  const box = entry.box ?? [0, 0, tw, th];
  let placed: [number, number, number, number];
  if (fit === "stretch") {
    const s = await scaled(img, tw, th);
    s.data.copy(out.data);
    placed = [0, 0, tw, th];
  } else {
    const k = Math.min(box[2] / img.w, box[3] / img.h);
    const w = Math.max(1, Math.round(img.w * k));
    const h = Math.max(1, Math.round(img.h * k));
    const s = await scaled(img, w, h);
    const ox = box[0] + Math.floor((box[2] - w) / 2);
    const oy = fit === "bottom" ? box[1] + box[3] - h : box[1] + Math.floor((box[3] - h) / 2);
    for (let y = 0; y < h; y++) s.data.copy(out.data, ((oy + y) * tw + ox) * 4, y * w * 4, (y + 1) * w * 4);
    placed = [ox, oy, w, h];
  }
  if (!entry.transparent) for (let p = 0; p < tw * th; p++) out.data[p * 4 + 3] = 255;
  else for (let p = 0; p < tw * th; p++) out.data[p * 4 + 3] = out.data[p * 4 + 3]! >= ALPHA_THRESHOLD ? 255 : 0;

  const prompts = readPrompts();
  const colors = quantize(out, parsePalette(prompts.palette));

  const outDir = assetDir(entry.type);
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${id}.png`);
  const tmp = `${file}.part`;
  await sharp(out.data, { raw: { width: tw, height: th, channels: 4 } }).png({ compressionLevel: 9 }).toFile(tmp);
  renameSync(tmp, file);

  record.processing = {
    input,
    output: file,
    alphaThreshold: entry.transparent ? ALPHA_THRESHOLD : null,
    backgroundKey: key ? { color: key, tolerance: KEY_TOLERANCE, mode: keyMode, pixelsRemoved: removed } : null,
    cropBox: crop,
    fit,
    placedAt: placed,
    targetSize: [tw, th],
    scaling: "nearest neighbour",
    palette: `${PROMPTS_FILE} (${prompts.palette.length} colours)`,
    dither: `ordered 4x4, strength ${DITHER}`,
    coloursUsed: colors,
    at: new Date().toISOString(),
  };
  writeRecord(dir, record);
  console.log(`process: ${id} -> ${file} (${tw}x${th}, ${colors} colours, crop ${crop.join(",")})`);
} catch (err) {
  fail((err as Error).message);
}
