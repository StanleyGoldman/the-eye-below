// Shared command-line handling for the toolbox scripts.

import { MODIFIERS, resolveMods } from "../../src/core/modifiers.ts";
import type { Mods } from "../../src/core/modifiers.ts";

export interface Args {
  flags: Record<string, string>;
  rest: string[];
}

/** Parses --name value and --switch (value "true"). */
export function parseArgs(argv: string[]): Args {
  const flags: Record<string, string> = {};
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a.startsWith("--")) {
      const name = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = "true";
      }
    } else {
      rest.push(a);
    }
  }
  return { flags, rest };
}

/** Modifier overrides from a string like "mapSize=3,traps=9". */
export function parseOverrides(text: string | undefined): Mods {
  const out: Mods = {};
  if (!text) return out;
  for (const part of text.split(",")) {
    const [name, value] = part.split("=");
    const def = MODIFIERS.find((m) => m.id === name || m.code === name);
    if (!def) throw new Error(`unknown modifier "${name}". Known: ${MODIFIERS.map((m) => m.id).join(", ")}`);
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 9) throw new Error(`modifier ${def.id} must be a whole number from 1 to 9`);
    out[def.id] = n;
  }
  return out;
}

export function runFromArgs(args: Args): { seed: string; mods: Mods; overrides: Mods } {
  const seed = args.flags["seed"] ?? "candle";
  const overrides = parseOverrides(args.flags["mods"]);
  return { seed, mods: resolveMods(seed, overrides), overrides };
}

export function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}
