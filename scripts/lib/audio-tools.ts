// ffmpeg and ffprobe, from the npm packages that carry the binaries
// (neither is installed on this machine), and a measurement helper.

import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function tool(name: "ffmpeg" | "ffprobe"): string {
  const pkg = name === "ffmpeg" ? "@ffmpeg-installer/ffmpeg" : "@ffprobe-installer/ffprobe";
  return (require(pkg) as { path: string }).path;
}

/** Length in seconds and mean and peak level in dB of an audio file. A silent file reports -120. */
export function probeAudio(file: string): { seconds: number; mean: number; max: number } {
  const seconds = Number(execFileSync(tool("ffprobe"), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());
  const r = spawnSync(tool("ffmpeg"), ["-hide_banner", "-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const text = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const mean = Number(/mean_volume: (-?[\d.]+|-inf) dB/.exec(text)?.[1] ?? "-inf");
  const max = Number(/max_volume: (-?[\d.]+|-inf) dB/.exec(text)?.[1] ?? "-inf");
  return { seconds, mean: Number.isFinite(mean) ? mean : -120, max: Number.isFinite(max) ? max : -120 };
}
