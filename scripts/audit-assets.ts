// Checks the generated assets against the manifest. One or more modes:
//
//   node scripts/audit-assets.ts --manifest           every entry is complete; enough image entries; every image id in the ASSETS table has one
//   node scripts/audit-assets.ts --files image        processed file, raw file, and a record with a kept attempt for every entry (or a recorded fallback)
//   node scripts/audit-assets.ts --pixels             processed images are at their manifest size, within the palette size, with alpha where required
//   node scripts/audit-assets.ts --workflows          the generation log has a successful, timed job for each of the seven workflows

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ASSETS } from "../src/assets/table.ts";
import { parseArgs } from "./lib/args.ts";
import { GENERATION_LOG, WORKFLOW_FILES, readRecord } from "./lib/comfy-api.ts";
import { assetDir, extension, rawDir, readFallbacks, readManifest, readPrompts } from "./lib/manifest.ts";
import type { AssetType, ManifestEntry } from "./lib/manifest.ts";

const MIN_IMAGES = 90;
const MAX_COLOURS = 64;
const args = parseArgs(process.argv.slice(2));
let failed = 0;

function check(ok: boolean, text: string): void {
  console.log(`${ok ? "ok  " : "FAIL"} ${text}`);
  if (!ok) failed++;
}

function listed(problems: string[]): string {
  return problems.length === 0 ? "" : `: ${problems.slice(0, 8).join("; ")}${problems.length > 8 ? `; and ${problems.length - 8} more` : ""}`;
}

const manifest = readManifest();
const fallbacks = new Set(readFallbacks());

if (args.flags["manifest"]) {
  const problems: string[] = [];
  const prompts = readPrompts();
  const seen = new Set<string>();
  const seeds = new Set<number>();
  for (const e of manifest.assets) {
    const missing: string[] = [];
    if (!e.id) missing.push("id");
    if (!["image", "frame", "music", "sfx"].includes(e.type)) missing.push("type");
    if (!e.workflow || !(e.workflow in WORKFLOW_FILES)) missing.push("workflow");
    if (!e.prompt || !e.prompt.subject || !Array.isArray(e.prompt.fragments)) missing.push("prompt");
    else for (const fr of e.prompt.fragments) if (prompts.fragments[fr] === undefined) missing.push(`fragment "${fr}"`);
    if (!Number.isInteger(e.seed)) missing.push("seed");
    if (!Array.isArray(e.size) || e.size.length !== 2 || !(e.size[0] > 0) || !(e.size[1] > 0)) missing.push("size");
    if (typeof e.transparent !== "boolean") missing.push("transparency flag");
    if (seen.has(e.id)) missing.push("duplicate id");
    if (seeds.has(e.seed)) missing.push("seed shared with another asset");
    seen.add(e.id);
    seeds.add(e.seed);
    if (missing.length > 0) problems.push(`${e.id || "(no id)"} lacks ${missing.join(", ")}`);
  }
  check(problems.length === 0, `manifest entries complete (id, type, workflow, prompt, seed, size, transparency): ${manifest.assets.length - problems.length} of ${manifest.assets.length}${listed(problems)}`);
  const images = manifest.assets.filter((e) => e.type === "image");
  check(images.length >= MIN_IMAGES, `image entries: ${images.length} (at least ${MIN_IMAGES})`);
  // Frames (attack poses, open doors, thrown switches) are a separate manifest type and arrive with animation.
  const imageIds = Object.values(ASSETS).filter((a) => !a.frame).map((a) => a.id);
  const without = imageIds.filter((id) => !seen.has(id));
  check(without.length === 0, `image ids in the ASSETS table with a manifest entry: ${imageIds.length - without.length} of ${imageIds.length}${listed(without)}`);
  const unknown = images.filter((e) => !ASSETS[e.id]).map((e) => e.id);
  check(unknown.length === 0, `manifest images the ASSETS table knows: ${images.length - unknown.length} of ${images.length}${listed(unknown)}`);
  check(prompts.palette.length <= MAX_COLOURS && prompts.palette.length > 0, `shared palette: ${prompts.palette.length} colours (at most ${MAX_COLOURS})`);
}

function ofTypes(types: string[]): ManifestEntry[] {
  return manifest.assets.filter((e) => types.includes(e.type));
}

if (args.flags["files"]) {
  const types = [args.flags["files"], ...args.rest].filter((t) => t !== "true") as AssetType[];
  if (types.length === 0) types.push("image");
  for (const type of types) {
    const entries = ofTypes([type]);
    let missing = 0;
    let fallbackCount = 0;
    const problems: string[] = [];
    for (const e of entries) {
      const record = readRecord(rawDir(e.type), e.id);
      const rejected = record.attempts.filter((a) => a.status === "rejected" && a.note.length > 0).length;
      if (fallbacks.has(e.id) || record.fallback) {
        fallbackCount++;
        if (!(record.fallback && fallbacks.has(e.id) && rejected >= 3)) {
          missing++;
          problems.push(`${e.id} is a fallback without three recorded rejected attempts`);
        }
        continue;
      }
      const why: string[] = [];
      const raw = path.join(rawDir(e.type), `${e.id}.${extension(e.type)}`);
      const processed = path.join(assetDir(e.type), `${e.id}.${extension(e.type)}`);
      if (!existsSync(processed) || statSync(processed).size === 0) why.push("no processed file");
      if (!existsSync(raw) || statSync(raw).size === 0) why.push("no raw file");
      const kept = record.attempts.filter((a) => a.status === "kept");
      if (kept.length !== 1 || kept[0]!.n !== record.kept) why.push(`${kept.length} attempts marked kept`);
      else if (kept[0]!.seed !== e.seed) why.push("the kept seed is not the one in the manifest");
      if (record.attempts.some((a) => a.status === "candidate")) why.push("an attempt is still awaiting review");
      if (record.attempts.some((a) => a.status === "rejected" && !a.note)) why.push("a rejected attempt has no reason");
      if (record.attempts.some((a) => !a.workflow || !a.promptId || !a.started || !(a.seconds > 0))) why.push("an attempt's record is incomplete");
      if ((e.type === "image" || e.type === "frame") && !record.processing) why.push("no post-processing record");
      if (e.transparent && e.key !== "all" && !record.cutout) why.push("no cutout record");
      if (why.length > 0) {
        missing++;
        problems.push(`${e.id}: ${why.join(", ")}`);
      }
    }
    const share = entries.length === 0 ? 0 : fallbackCount / entries.length;
    check(entries.length > 0, `${type} entries in the manifest: ${entries.length}`);
    check(share <= 0.1, `${type} fallbacks: ${fallbackCount} of ${entries.length} (at most 10%)`);
    check(missing === 0, `${type} files, raws, and records${listed(problems)}`);
    console.log(`missing: ${missing}`);
  }
}

if (args.flags["pixels"]) {
  const problems: string[] = [];
  let checkedCount = 0;
  let most = 0;
  for (const e of ofTypes(["image", "frame"])) {
    if (fallbacks.has(e.id)) continue;
    const file = path.join(assetDir(e.type), `${e.id}.png`);
    if (!existsSync(file)) {
      problems.push(`${e.id}: no file`);
      continue;
    }
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const colours = new Set<number>();
    let clear = 0;
    let partial = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]!;
      if (a === 0) clear++;
      else {
        if (a !== 255) partial++;
        colours.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
      }
    }
    const why: string[] = [];
    if (info.width !== e.size[0] || info.height !== e.size[1]) why.push(`is ${info.width}x${info.height}, manifest says ${e.size[0]}x${e.size[1]}`);
    if (colours.size > MAX_COLOURS) why.push(`${colours.size} colours`);
    if (partial > 0) why.push("has half-transparent pixels");
    if (e.transparent && clear === 0) why.push("should have transparent pixels and has none");
    if (!e.transparent && clear > 0) why.push("has transparent pixels and should not");
    if (colours.size < 2) why.push("is a single flat colour");
    most = Math.max(most, colours.size);
    checkedCount++;
    if (why.length > 0) problems.push(`${e.id} ${why.join(", ")}`);
  }
  check(problems.length === 0, `processed images at manifest size, ${MAX_COLOURS} colours or fewer (most used: ${most}), alpha as declared: ${checkedCount - problems.length} of ${checkedCount}${listed(problems)}`);
}

if (args.flags["workflows"]) {
  const lines = existsSync(GENERATION_LOG) ? readFileSync(GENERATION_LOG, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as { workflow: string; seconds: number; ok: boolean }) : [];
  for (const [key, file] of Object.entries(WORKFLOW_FILES)) {
    const jobs = lines.filter((l) => l.workflow === file && l.ok && l.seconds > 0);
    const first = jobs[0];
    check(jobs.length > 0, `${key} (${file}): ${jobs.length} successful timed job(s)${first ? `, first took ${first.seconds} s` : ""}`);
  }
  console.log(`generation log: ${lines.length} jobs in ${GENERATION_LOG}`);
}

if (!args.flags["manifest"] && !args.flags["files"] && !args.flags["pixels"] && !args.flags["workflows"]) {
  console.log("usage: node scripts/audit-assets.ts [--manifest] [--files image [frame music sfx]] [--pixels] [--workflows]");
  process.exit(1);
}
console.log(failed === 0 ? "audit-assets: ok" : `audit-assets: ${failed} check(s) FAILED`);
process.exit(failed === 0 ? 0 : 1);
