// Reading the asset manifest and the shared prompt fragments.

import { createHash } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";

export const MANIFEST_FILE = "assets/manifest.json";
export const PROMPTS_FILE = "assets/prompts.json";
export const FALLBACKS_FILE = "assets/fallbacks.json";

export type AssetType = "image" | "frame" | "music" | "sfx";

export interface ManifestEntry {
  id: string;
  type: AssetType;
  /** What kind of picture or sound it is; decides post-processing. */
  kind: string;
  /** flux2, zimage, krea2, qwen_edit, ace_step, or stable_audio. */
  workflow: string;
  prompt: { subject: string; fragments: string[] };
  seed: number;
  /** Final size in pixels [w, h], or seconds [min, max] for audio. */
  size: [number, number];
  /** Size the image is generated at. */
  gen?: [number, number];
  transparent: boolean;
  /** How the picture is fitted into its final size. */
  fit?: "bottom" | "center" | "stretch";
  /** Asset id whose kept raw image is the style reference (krea2) or the image to edit (qwen_edit). */
  reference?: string;
  /** How many candidates to generate before choosing (krea2 varies by seed). */
  candidates?: number;
  /** Where in the final picture the subject is fitted: [x, y, w, h]. The whole picture when left out. */
  box?: [number, number, number, number];
  /** "all" removes background colour everywhere, for grids and bars; the default only works inward from the edges. */
  key?: "all" | "edge";
  /** Audio only: seconds to generate. The size field holds the allowed range. */
  duration?: number;
  /** Music only. */
  bpm?: number;
  keyscale?: string;
}

export interface Manifest {
  version: number;
  assets: ManifestEntry[];
}

export interface Prompts {
  version: number;
  fragments: Record<string, string>;
  palette: string[];
}

export function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_FILE, "utf8")) as Manifest;
}

export function writeManifest(m: Manifest): void {
  const tmp = `${MANIFEST_FILE}.part`;
  writeFileSync(tmp, `${JSON.stringify(m, null, 1)}\n`);
  renameSync(tmp, MANIFEST_FILE);
}

export function readPrompts(): Prompts {
  return JSON.parse(readFileSync(PROMPTS_FILE, "utf8")) as Prompts;
}

export function entryOf(m: Manifest, id: string): ManifestEntry {
  const e = m.assets.find((a) => a.id === id);
  if (!e) throw new Error(`no manifest entry for "${id}"`);
  return e;
}

/** The full prompt text: the subject followed by each named fragment. */
export function resolvePrompt(prompts: Prompts, entry: ManifestEntry): string {
  const parts = [entry.prompt.subject];
  for (const name of entry.prompt.fragments) {
    const text = prompts.fragments[name];
    if (text === undefined) throw new Error(`asset ${entry.id} uses prompt fragment "${name}", which is not in ${PROMPTS_FILE}`);
    parts.push(text);
  }
  return parts.join(", ");
}

/** Changes whenever something that affects the generated picture changes. The seed is left out so choosing another seed is not a new request. */
export function requestKey(prompts: Prompts, entry: ManifestEntry): string {
  return createHash("sha256").update(JSON.stringify([entry.workflow, resolvePrompt(prompts, entry), entry.gen ?? entry.size, entry.reference ?? "", entry.bpm ?? 0, entry.keyscale ?? ""])).digest("hex").slice(0, 16);
}

/** The base picture and every frame edited from it: one animation. A picture with no frames is a group of one. */
export function animationOf(manifest: Manifest, entry: ManifestEntry): ManifestEntry[] {
  const isEdit = (e: ManifestEntry): boolean => e.workflow === "qwen_edit" && !!e.reference;
  const baseId = isEdit(entry) ? (entry.reference as string) : entry.id;
  const base = manifest.assets.find((a) => a.id === baseId);
  const members = manifest.assets.filter((a) => isEdit(a) && a.reference === baseId);
  return base ? [base, ...members] : [entry];
}

export function rawDir(type: AssetType): string {
  return type === "image" ? "raw/images" : type === "frame" ? "raw/frames" : type === "music" ? "raw/music" : "raw/sfx";
}

export function assetDir(type: AssetType): string {
  return type === "image" ? "assets/images" : type === "frame" ? "assets/frames" : type === "music" ? "assets/music" : "assets/sfx";
}

export function extension(type: AssetType): string {
  return type === "image" || type === "frame" ? "png" : "mp3";
}

export function readFallbacks(): string[] {
  try {
    return (JSON.parse(readFileSync(FALLBACKS_FILE, "utf8")) as { fallbacks: string[] }).fallbacks;
  } catch {
    return [];
  }
}
