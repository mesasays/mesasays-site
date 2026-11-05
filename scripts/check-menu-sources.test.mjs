import assert from "node:assert/strict";
import test from "node:test";
import { checkSource, fingerprint } from "./check-menu-sources.mjs";

const menu = { slug: "example", url: "https://example.org/menu", publication: { coverage: "food_menu", checkedAt: "2026-10-07", recheckAfter: "2026-10-08" } };
const html = Buffer.from(`<html><body>${"Tacos 100 MXN. ".repeat(20)}</body></html>`);
test("unchanged retrieval never refreshes the editorial review date", async () => {
  const prior = { sourceUrl: menu.url, fingerprint: fingerprint(html, "html") };
  const result = await checkSource(menu, prior, async () => new Response(html));
  assert.equal(result.status, "unchanged");
  assert.equal(result.reviewedAt, "2026-10-07");
  assert.equal(menu.publication.checkedAt, "2026-10-07");
});
test("a price change is detected; an outage preserves the prior fingerprint", async () => {
  const prior = { sourceUrl: menu.url, fingerprint: fingerprint(html, "html") };
  const changed = await checkSource(menu, prior, async () => new Response(html.toString().replaceAll("100", "120")));
  assert.equal(changed.status, "changed");
  const unavailable = await checkSource(menu, prior, async () => new Response("Unavailable", { status: 503 }));
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.fingerprint, prior.fingerprint);
});
test("a Drive login page cannot be accepted as a PDF menu", () => {
  assert.throws(() => fingerprint(Buffer.from("<html>Sign in</html>"), "pdf"));
});
test("social sources never trigger automated browser scraping", async () => {
  const result = await checkSource({ ...menu, publication: { ...menu.publication, coverage: "dishes" } }, null,
    () => { throw new Error("Must not fetch social posts"); });
  assert.equal(result.status, "manual_source");
});

test("a PDF or image menu served from the restaurant's own site is fingerprinted by content", async () => {
  const site = { slug: "pdf-site", url: "https://example.org/s/menu.pdf", publication: { coverage: "food_menu", checkedAt: "2026-10-07", recheckAfter: "2026-11-06" } };
  const pdf = Buffer.from("%PDF-1.7 menu tacos 100 MXN");
  const first = await checkSource(site, undefined, async () => new Response(pdf, { headers: { "content-type": "application/pdf" } }));
  assert.equal(first.status, "baseline");
  assert.equal(first.kind, "pdf");
  const same = await checkSource(site, { sourceUrl: site.url, fingerprint: first.fingerprint }, async () => new Response(pdf));
  assert.equal(same.status, "unchanged");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const image = await checkSource({ ...site, url: "https://example.org/menu.png" }, undefined, async () => new Response(png, { headers: { "content-type": "image/png" } }));
  assert.equal(image.kind, "image");
  assert.equal(image.status, "baseline");
});
