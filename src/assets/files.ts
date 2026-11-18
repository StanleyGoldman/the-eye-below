// Which asset ids have a generated file to load. Taken from the manifest
// at build time, so the page never has to read a file to find out.

import fallbacks from "../../assets/fallbacks.json";
import manifest from "../../assets/manifest.json";

const skip = new Set<string>(fallbacks.fallbacks as string[]);
const entries = (manifest.assets as { id: string; type: string }[]).filter((a) => !skip.has(a.id));
const folder = new Map<string, string>();
for (const a of entries) folder.set(a.id, a.type === "image" ? "images" : a.type === "frame" ? "frames" : a.type);

/** Image and frame ids with a processed file under assets/images/ or assets/frames/. */
export const FILE_IDS: readonly string[] = entries.filter((a) => a.type === "image" || a.type === "frame").map((a) => a.id);
export const MUSIC_IDS: readonly string[] = entries.filter((a) => a.type === "music").map((a) => a.id);
export const SFX_IDS: readonly string[] = entries.filter((a) => a.type === "sfx").map((a) => a.id);

export function filePath(id: string): string {
  return `assets/${folder.get(id) ?? "images"}/${id}.png`;
}

export function audioPath(id: string): string {
  return `assets/${folder.get(id) ?? "sfx"}/${id}.mp3`;
}
