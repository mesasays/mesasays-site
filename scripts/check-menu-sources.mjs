#!/usr/bin/env node
// Read public sources directly. A matching fingerprint is NOT a menu verification.
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const menusDir = resolve(root, "restaurant-intelligence/v1/menus");

export function sourceRequest(menu) {
  if (menu.publication.coverage === "dishes") return null;
  const url = new URL(menu.url);
  const driveId = url.hostname === "drive.google.com" && url.pathname.match(/^\/file\/d\/([\w-]+)\//)?.[1];
  return driveId
    ? { url: `https://drive.google.com/uc?export=download&id=${driveId}`, kind: "pdf" }
    : { url: menu.url, kind: "html" };
}

export function fingerprint(bytes, kind) {
  if (kind === "pdf") {
    if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Expected public PDF; received a different response");
    return createHash("sha256").update(bytes).digest("hex");
  }
  const html = bytes.toString("utf8");
  if (!/<(?:html|body|main)\b/i.test(html)) throw new Error("Expected HTML page");
  // Ignore scripts, styles, comments and whitespace; page changes still require review.
  const text = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 200 || /^(just a moment|access denied|forbidden)/i.test(text)) {
    throw new Error("Page is empty or blocked");
  }
  return createHash("sha256").update(text).digest("hex");
}

export async function checkSource(menu, previous, fetchSource = fetch) {
  const source = sourceRequest(menu);
  const row = { slug: menu.slug, sourceUrl: menu.url, reviewedAt: menu.publication.checkedAt,
    reviewDue: menu.publication.recheckAfter };
  if (!source) return { ...row, status: "manual_source", reason: "Official social posts: obtain a stable menu URL or restaurant feed" };
  try {
    const response = await fetchSource(source.url, {
      signal: AbortSignal.timeout(30000),
      headers: { "User-Agent": "TheDiningDispatch-MenuCheck/1.0 (+https://thediningdispatch.fr)", Accept: source.kind === "pdf" ? "application/pdf" : "text/html" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024) throw new Error("Source exceeds 20 MB");
    const hash = fingerprint(bytes, source.kind);
    const priorHash = previous?.sourceUrl === menu.url ? previous?.fingerprint : undefined;
    return { ...row, kind: source.kind, status: !priorHash ? "baseline" : hash === priorHash ? "unchanged" : "changed",
      fingerprint: hash, bytes: bytes.length };
  } catch (error) {
    return { ...row, kind: source.kind, status: "unavailable", reason: error.name === "TimeoutError" ? "Timed out" : error.message,
      // Preserve the last successful fingerprint across an outage.
      ...(previous?.sourceUrl === menu.url && previous.fingerprint ? { fingerprint: previous.fingerprint } : {}) };
  }
}

async function main() {
  const output = resolve(root, "reports/menu-monitor/latest.json");
  let previous = { sources: [] };
  try { previous = JSON.parse(await readFile(output, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const sources = [];
  for (const file of (await readdir(menusDir)).filter(file => file.endsWith(".json")).sort()) {
    const menu = JSON.parse(await readFile(resolve(menusDir, file), "utf8"));
    if (!menu.publication) continue;
    const result = await checkSource(menu, previous.sources.find(row => row.slug === menu.slug));
    sources.push(result);
    console.log(`${result.slug}: ${result.status}${result.reason ? ` — ${result.reason}` : ""}`);
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(),
    notice: "Retrieval only. Unchanged does not confirm availability, accuracy or current prices. Published records and review dates are never modified.", sources }, null, 2) + "\n");
  console.log("Report: reports/menu-monitor/latest.json");
  if (sources.some(row => row.status === "unavailable")) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
