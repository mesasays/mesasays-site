#!/usr/bin/env node
// Copy every Say conversation from the Supabase project "MesaSay" into our own Postgres,
// keeping ids and timestamps, so links like /say/<id> keep working after the switch.
//
//   SAY_SUPABASE_URL=https://<project>.supabase.co \
//   SAY_SUPABASE_PUBLISHABLE_KEY=... \
//   MIGRATE_DATABASE_URL=postgres://postgres@/mesasays?host=/var/run/postgresql \
//   node infra/postgres/migrate-from-supabase.mjs [--dry-run]
//
// MIGRATE_DATABASE_URL must be an admin login (the postgres superuser or the table owner):
// the app role cannot insert directly, on purpose. Re-running is safe: rows already copied
// (same id) are skipped, so you can run it once before the switch and once right after.
//
// LIMIT: the publishable key only sees *published* rows (row level security). Hidden
// (moderated) threads and replies are NOT copied that way. To copy them too, also set
// SAY_SUPABASE_SECRET_KEY (Supabase dashboard -> Project settings -> API keys -> secret key)
// in the shell for that one run; never write it to a file. Without it, hidden rows stay
// behind, which is usually what we want anyway.
import pg from "pg";

const url = process.env.SAY_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SAY_SUPABASE_SECRET_KEY || process.env.SAY_SUPABASE_PUBLISHABLE_KEY;
const databaseUrl = process.env.MIGRATE_DATABASE_URL;
const dryRun = process.argv.includes("--dry-run");
if (!url || !key) throw new Error("Set SAY_SUPABASE_URL and SAY_SUPABASE_PUBLISHABLE_KEY");
if (!databaseUrl && !dryRun) throw new Error("Set MIGRATE_DATABASE_URL (admin login to our Postgres)");
const usingSecret = Boolean(process.env.SAY_SUPABASE_SECRET_KEY);

const PAGE = 1000;
async function readAll(table, order) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&order=${order}&limit=${PAGE}&offset=${offset}`, {
      headers: { apikey: key, ...(usingSecret ? { Authorization: `Bearer ${key}` } : {}) },
    });
    if (!response.ok) throw new Error(`${table}: HTTP ${response.status} ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

const threads = await readAll("say_threads", "created_at.asc,id.asc");
const replies = await readAll("say_replies", "created_at.asc,id.asc");
const links = await readAll("say_links", "created_at.asc,thread_id.asc");
console.log(`Supabase (${usingSecret ? "secret key: all rows" : "publishable key: published rows only"}): ${threads.length} threads, ${replies.length} replies, ${links.length} links`);

// A reply can answer another reply: insert parents before children.
const ordered = [];
const placed = new Set();
let pending = replies;
while (pending.length) {
  const next = pending.filter((reply) => !reply.parent_id || placed.has(reply.parent_id));
  if (!next.length) {
    console.warn(`Skipping ${pending.length} replies whose parent is not readable (hidden?): ${pending.map((r) => r.id).join(", ")}`);
    break;
  }
  for (const reply of next) {
    ordered.push(reply);
    placed.add(reply.id);
  }
  pending = pending.filter((reply) => !placed.has(reply.id));
}
const threadIds = new Set(threads.map((thread) => thread.id));

if (dryRun) {
  console.log("Dry run: nothing written.");
  process.exit(0);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
const counts = { threads: 0, replies: 0, links: 0 };
const json = (value) => (value === undefined || value === null ? null : JSON.stringify(value));
try {
  await client.query("begin");
  for (const t of threads) {
    const result = await client.query(
      `insert into say_threads (id, created_at, author, title, body, status, signer, signature, signed_at, signed_payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) on conflict (id) do nothing`,
      [t.id, t.created_at, t.author, t.title, t.body ?? "", t.status ?? "published", t.signer ?? null, t.signature ?? null, t.signed_at ?? null, json(t.signed_payload)],
    );
    counts.threads += result.rowCount;
  }
  for (const r of ordered) {
    if (!threadIds.has(r.thread_id)) continue;
    const result = await client.query(
      `insert into say_replies (id, thread_id, parent_id, created_at, author, body, status, signer, signature, signed_at, signed_payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) on conflict (id) do nothing`,
      [r.id, r.thread_id, r.parent_id, r.created_at, r.author, r.body, r.status ?? "published", r.signer ?? null, r.signature ?? null, r.signed_at ?? null, json(r.signed_payload)],
    );
    counts.replies += result.rowCount;
  }
  for (const l of links) {
    if (!threadIds.has(l.thread_id)) continue;
    const result = await client.query(
      `insert into say_links (thread_id, restaurant_slug, linked_by, created_at)
       values ($1, $2, $3, $4) on conflict (thread_id, restaurant_slug) do nothing`,
      [l.thread_id, l.restaurant_slug, l.linked_by ?? "poster", l.created_at],
    );
    counts.links += result.rowCount;
  }
  await client.query("commit");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
console.log(`Postgres: inserted ${counts.threads} threads, ${counts.replies} replies, ${counts.links} links (existing rows skipped).`);
