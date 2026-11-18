// Puts together the copy of the game that can be handed to a player:
// a folder holding only what the page loads, and a zip of that folder.
//
//   node scripts/package.ts              (what "make package" runs)
//   node scripts/package.ts --no-verify  (skip the browser run of the packaged copy)
//
// Output, named after the name and version in package.json:
//   out/package/<name>-<version>/        index.html, dist/game.js, assets/, README.txt, the font licence
//   out/package/<name>-<version>.zip     the same folder, zipped
//
// The bundle must already be built ("make package" sees to that). Only
// the asset files the bundle asks for are copied: every manifest entry
// that is not a fallback. A missing one stops the packaging. Nothing is
// ever generated here, so ComfyUI is not needed.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fail, parseArgs } from "./lib/args.ts";
import { assetDir, extension, readFallbacks, readManifest } from "./lib/manifest.ts";

const OUT = "out/package";
const BUNDLE = "dist/game.js";
const FONT_LICENCE = "node_modules/@fontsource/vt323/LICENSE";

const args = parseArgs(process.argv.slice(2));
if (args.flags["help"]) {
  console.log("usage: node scripts/package.ts [--no-verify]");
  process.exit(0);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { name: string; version: string; description: string };
const name = `${pkg.name}-${pkg.version}`;
const stage = path.join(OUT, name);
const zipFile = path.join(OUT, `${name}.zip`);

/** Every asset file the bundle will ask for, as paths from the project root. */
function assetFiles(): string[] {
  const skip = new Set(readFallbacks());
  return readManifest()
    .assets.filter((a) => !skip.has(a.id))
    .map((a) => `${assetDir(a.type)}/${a.id}.${extension(a.type)}`);
}

/** The Play section of README.md from its key table on, as plain text. */
function controls(): string {
  const readme = readFileSync("README.md", "utf8");
  const section = /^## Play\n([\s\S]*?)(?=^## )/m.exec(readme)?.[1] ?? "";
  const start = section.indexOf("| Key |");
  if (start < 0) fail('README.md has no key table under "## Play", so the player\'s README.txt cannot be written');
  const lines = section.slice(start).trimEnd().split("\n");
  const rows = lines.filter((l) => l.startsWith("|") && !/^\|[-| ]+\|$/.test(l)).map((l) => l.slice(1, -1).split("|").map((c) => c.trim()));
  const width = Math.max(...rows.map((r) => (r[0] as string).length));
  const table = rows.map((r) => `  ${(r[0] as string).padEnd(width)}  ${r[1]}`);
  const prose = lines.filter((l) => !l.startsWith("|")).map((l) => l.replace(/`/g, ""));
  return [...table, ...prose].join("\n");
}

function playerReadme(): string {
  const title = `The Eye Below ${pkg.version}`;
  return [
    title,
    "=".repeat(title.length),
    "",
    pkg.description,
    "",
    "To play, open index.html in a web browser: double-click it, or drag",
    "it into a browser window. Nothing is installed and nothing is sent",
    "anywhere. Keep index.html together with the dist and assets folders",
    "beside it. Your saved game and settings are kept by the browser you",
    "play in.",
    "",
    controls(),
    "",
    "Credits",
    "-------",
    "",
    "The typeface is VT323 by Peter Hull, under the SIL Open Font",
    "License. The licence is in LICENSE-VT323.txt.",
    "",
  ].join("\n");
}

function copy(from: string, to: string): void {
  mkdirSync(path.dirname(path.join(stage, to)), { recursive: true });
  copyFileSync(from, path.join(stage, to));
}

/** Every file under a folder, as paths relative to it. */
function listFiles(dir: string, under = ""): string[] {
  return readdirSync(path.join(dir, under), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listFiles(dir, path.join(under, e.name)) : [path.join(under, e.name)]));
}

const megabytes = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// ---- what goes in --------------------------------------------------------

if (!existsSync(BUNDLE)) fail(`${BUNDLE} is not built. Run "make package", which builds it first`);
if (!existsSync(FONT_LICENCE)) fail(`${FONT_LICENCE} is missing. Run "make deps"`);
const assets = assetFiles();
const missing = assets.filter((f) => !existsSync(f));
if (missing.length > 0) {
  fail(`${missing.length} of ${assets.length} asset files ${missing.length === 1 ? "is" : "are"} missing (${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", ..." : ""}). Run "make processed" to rebuild them from raw/, or "make assets" to generate them`);
}
const page = readFileSync("index.html", "utf8");
if (!page.includes(`src="${BUNDLE}"`)) fail(`index.html no longer loads ${BUNDLE}, so the package layout in scripts/package.ts is out of date`);

// ---- the folder ----------------------------------------------------------

// The folder is rebuilt from nothing each time, so a file dropped from the manifest never lingers in it.
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
copy("index.html", "index.html");
copy(BUNDLE, BUNDLE);
for (const f of assets) copy(f, f);
copy(FONT_LICENCE, "LICENSE-VT323.txt");
writeFileSync(path.join(stage, "README.txt"), playerReadme());

const files = listFiles(stage);
const total = files.reduce((sum, f) => sum + statSync(path.join(stage, f)).size, 0);
console.log(`package: ${stage}/ holds ${files.length} files, ${megabytes(total)} (${assets.length} assets)`);

// ---- does the packaged copy run on its own? ------------------------------

if (args.flags["no-verify"] === "true") {
  console.log("package: browser run skipped (--no-verify)");
} else {
  // The assets scenario opens index.html from the current folder, so run from inside the package:
  // every image must load from there, with no help from the project around it.
  const shots = path.resolve("out/shots/package");
  const run = spawnSync(process.execPath, [path.resolve("scripts/play.ts"), "--scenario", "assets", "--out", shots], { cwd: stage, encoding: "utf8" });
  if (run.status !== 0) {
    process.stdout.write(run.stdout ?? "");
    process.stderr.write(run.stderr ?? "");
    fail(`the packaged copy failed its browser run, so no zip was written. The folder is left at ${stage}/ to look at`);
  }
  console.log(`package: the packaged copy passed its browser run (screenshots in ${path.relative(".", shots)}/)`);
}

// ---- the zip -------------------------------------------------------------

const part = `${zipFile}.part`;
rmSync(part, { force: true });
// -X leaves out owner ids and extra timestamps; the folder itself is the zip's single top-level entry.
const zip = spawnSync("zip", ["-r", "-X", "-q", `${name}.zip.part`, name], { cwd: OUT, encoding: "utf8" });
if (zip.error || zip.status !== 0) {
  rmSync(part, { force: true });
  const why = zip.error ? 'the "zip" command was not found (on Debian or Ubuntu: sudo apt install zip)' : (zip.stderr ?? "").trim() || `zip exited with ${zip.status}`;
  fail(`could not write ${zipFile}: ${why}. The folder ${stage}/ is complete and can be shared as it is`);
}
renameSync(part, zipFile);
console.log(`package: wrote ${zipFile} (${megabytes(statSync(zipFile).size)})`);
