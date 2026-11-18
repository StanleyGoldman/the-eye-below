// Which asset ids have a generated file to load. Taken from the manifest
// at build time, so the page never has to read a file to find out.

import fallbacks from "../../assets/fallbacks.json";
import manifest from "../../assets/manifest.json";

const skip = new Set<string>(fallbacks.fallbacks as string[]);

/** Image ids with a processed file under assets/images/. */
export const FILE_IDS: readonly string[] = (manifest.assets as { id: string; type: string }[]).filter((a) => a.type === "image" && !skip.has(a.id)).map((a) => a.id);

export function filePath(id: string): string {
  return `assets/images/${id}.png`;
}
