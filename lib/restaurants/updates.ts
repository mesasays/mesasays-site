import "server-only";

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { V1_ROOT, VERIFIED_ROOT } from "@/lib/restaurants/paths";

// A dated change log derived from the data itself: waves of additions,
// re-verification runs and documented closures. Nothing is typed by hand.

export type UpdateEntry = {
  date: string;
  kind: "added" | "reverified" | "closed";
  id: string;
  restaurants: Array<{ slug: string; name: string; note?: string | null }>;
  counts?: { verified: number; unverifiable: number };
};

type RegistryRow = { slug: string; name: string; status?: string; wave?: string; closedReason?: string | null; closedCheckedAt?: string | null };
type Overlay = { slug: string; verdict: string; verifiedAt: string; run?: string };

let updates: Promise<UpdateEntry[]> | null = null;

async function load(): Promise<UpdateEntry[]> {
  const registry = JSON.parse(await readFile(join(V1_ROOT, "registry.json"), "utf8")) as RegistryRow[];
  const names = new Map(registry.map((row) => [row.slug, row.name]));
  const entries: UpdateEntry[] = [];

  const waves = new Map<string, RegistryRow[]>();
  for (const row of registry) {
    if (row.wave && row.status !== "closed") waves.set(row.wave, [...(waves.get(row.wave) ?? []), row]);
  }
  for (const [wave, rows] of waves) {
    entries.push({
      date: wave.slice(0, 10),
      kind: "added",
      id: wave,
      restaurants: rows.map((row) => ({ slug: row.slug, name: row.name })).sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  const overlays: Overlay[] = [];
  try {
    for (const file of await readdir(VERIFIED_ROOT)) {
      if (file.endsWith(".json")) overlays.push(JSON.parse(await readFile(join(VERIFIED_ROOT, file), "utf8")));
    }
  } catch {
    // No re-verification yet.
  }
  const runs = new Map<string, Overlay[]>();
  for (const overlay of overlays) {
    const run = overlay.run ?? overlay.verifiedAt;
    runs.set(run, [...(runs.get(run) ?? []), overlay]);
  }
  for (const [run, rows] of runs) {
    const checked = rows.filter((row) => row.verdict !== "closed");
    if (!checked.length) continue;
    entries.push({
      date: run.slice(0, 10),
      kind: "reverified",
      id: run,
      restaurants: [],
      counts: {
        verified: checked.filter((row) => row.verdict === "verified").length,
        unverifiable: checked.filter((row) => row.verdict === "unverifiable").length,
      },
    });
  }

  const closed = registry.filter((row) => row.status === "closed");
  const byDate = new Map<string, RegistryRow[]>();
  for (const row of closed) {
    const date = row.closedCheckedAt ?? "unknown";
    byDate.set(date, [...(byDate.get(date) ?? []), row]);
  }
  for (const [date, rows] of byDate) {
    entries.push({
      date,
      kind: "closed",
      id: `closed-${date}`,
      restaurants: rows.map((row) => ({ slug: row.slug, name: names.get(row.slug) ?? row.name, note: row.closedReason })),
    });
  }

  const order = { added: 0, reverified: 1, closed: 2 };
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id) || order[a.kind] - order[b.kind]);
}

export function listUpdates() {
  updates ??= load();
  return updates;
}
