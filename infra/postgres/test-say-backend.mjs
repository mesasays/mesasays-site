#!/usr/bin/env node
// End-to-end check of Say on Postgres, through the real website code:
// it calls the postThread / postReply server actions over HTTP exactly as the browser does,
// then reads the conversation back through /say/threads, /say/<id> and the database itself.
//
//   BASE_URL=http://127.0.0.1:3123 DATABASE_URL=postgres://... node infra/postgres/test-say-backend.mjs
//
// The website at BASE_URL must run with SAY_BACKEND=postgres against the same DATABASE_URL
// (a throwaway database: this writes a test thread and reply).
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const base = (process.env.BASE_URL || "http://127.0.0.1:3123").replace(/\/$/, "");
const manifestPath = process.env.ACTION_MANIFEST || join(root, ".next/server/server-reference-manifest.json");
const slug = process.env.TEST_SLUG || "pujol";

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const actionId = (name) => {
  const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === name && value.filename?.includes("app/say/actions"));
  if (!entry) throw new Error(`server action ${name} not found in ${manifestPath}`);
  return entry[0];
};

async function callAction(name, input) {
  const response = await fetch(`${base}/restaurants/${slug}`, {
    method: "POST",
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: base },
    body: JSON.stringify([input]),
  });
  const text = await response.text();
  const ok = text.match(/"ok":true,"id":"([0-9a-f-]{36})"/);
  if (!response.ok || !ok) throw new Error(`${name}: HTTP ${response.status}: ${text.slice(0, 400)}`);
  return ok[1];
}

const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition) process.exitCode = 1;
};

const stamp = new Date().toISOString();
const threadId = await callAction("postThread", { author: "pg_tester", text: `Postgres test at ${stamp}. What should I order at the bar?`, slug, website: "" });
check(`postThread server action -> thread ${threadId}`, true);
const replyId = await callAction("postReply", { threadId, parentId: null, author: "pg_tester2", body: "The tostada, and skip dessert.", website: "" });
check(`postReply server action -> reply ${replyId}`, true);
const nestedId = await callAction("postReply", { threadId, parentId: replyId, author: "pg_tester", body: "Thanks!", website: "" });
check(`nested postReply -> reply ${nestedId}`, true);

const listed = await (await fetch(`${base}/say/threads?slug=${slug}`)).json();
const thread = listed.threads.find((item) => item.id === threadId);
check("/say/threads lists the new thread for the restaurant", Boolean(thread));
check("thread is linked to the restaurant", thread?.slugs.includes(slug));
check("thread has its 2 replies in order", thread?.replies.length === 2 && thread.replies[0].id === replyId && thread.replies[1].parentId === replyId);
check("restaurant name resolved for the linked place", listed.places.some((place) => place.slug === slug));

const page = await fetch(`${base}/say/${threadId}`);
const html = await page.text();
check(`/say/${threadId} renders (HTTP ${page.status})`, page.status === 200 && html.includes("What should I order at the bar"));
const feed = await (await fetch(`${base}/say`)).text();
check("/say feed shows the thread", feed.includes(`Postgres test at ${stamp}`));

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(
  "select t.author, t.title, (select count(*) from say_replies r where r.thread_id = t.id)::int as replies from say_threads t where t.id = $1",
  [threadId],
);
check(`database row: ${JSON.stringify(rows[0])}`, rows[0]?.replies === 2);
// The app role must not be able to write directly (only through the say_* functions).
const denied = await client.query("insert into say_threads (author, title) values ('x', 'direct insert')").then(() => false, (error) => error.code === "42501");
check("app role cannot insert directly (permission denied)", denied);
const hidden = await client.query("select count(*)::int as n from say_threads where status = 'hidden'");
check("app role sees no hidden rows", hidden.rows[0].n === 0);
await client.end();
