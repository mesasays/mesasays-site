import "server-only";

import { checkStored, type NoteProof, type SayProof } from "@/lib/say/signature";

// Say storage: the MesaSay Supabase project, reached over its REST API with the public key.
// That key can only read published posts and call say_post / say_reply / say_post_signed / say_reply_signed
// (see supabase/say/*.sql). The database cannot check Ethereum signatures: every stored signature is checked
// again here on read, so a row that claims a signature it does not have shows as "signature invalid".
// SAY_BACKEND=postgres switches storage to our own Postgres (lib/say/pg.ts, infra/postgres/schema.sql):
// same functions, same row shape, same signature checks.

export type SayReply = { id: string; parentId: string | null; author: string; body: string; createdAt: string; proof: SayProof | null };
export type SayThreadData = {
  id: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  slugs: string[];
  replies: SayReply[];
  proof: SayProof | null;
};

type Signed = { signer?: string | null; signature?: string | null; signed_payload?: unknown };
type ReplyRow = Signed & { id: string; parent_id: string | null; author: string; body: string; created_at: string };
type Row = Signed & {
  id: string;
  title: string;
  body: string;
  author: string;
  created_at: string;
  say_links: Array<{ restaurant_slug: string }>;
  say_replies: ReplyRow[];
};

const SIGNED = "signer,signature,signed_payload";
const SELECT_SIGNED = `id,title,body,author,created_at,${SIGNED},say_links(restaurant_slug),say_replies(id,parent_id,author,body,created_at,${SIGNED})`;
const SELECT_LEGACY = "id,title,body,author,created_at,say_links(restaurant_slug),say_replies(id,parent_id,author,body,created_at)";

// Until supabase/say/20261101000000_signed_notes.sql is applied, the signature columns do not exist:
// read without them (everything shows "not signed") and try again a few minutes later.
let legacyUntil = 0;
const select = () => (Date.now() < legacyUntil ? SELECT_LEGACY : SELECT_SIGNED);

class SayError extends Error {
  constructor(message: string, readonly code: string | undefined) {
    super(message);
  }
}

const postgres = () => (process.env.SAY_BACKEND === "postgres" ? import("@/lib/say/pg") : null);

function config() {
  const url = process.env.SAY_SUPABASE_URL;
  const key = process.env.SAY_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Say is not configured: SAY_SUPABASE_URL / SAY_SUPABASE_PUBLISHABLE_KEY missing");
  return { url, headers: { apikey: key, "Content-Type": "application/json" } };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, headers } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init?.headers }, cache: "no-store" });
  const text = await response.text();
  if (!response.ok) {
    const { message, code } = (() => {
      try {
        const json = JSON.parse(text) as { message?: string; code?: string };
        return { message: json.message ?? text, code: json.code };
      } catch {
        return { message: text, code: undefined };
      }
    })();
    throw new SayError(message || `Say request failed (${response.status})`, code);
  }
  return (text ? JSON.parse(text) : null) as T;
}

/** Reads threads, falling back to the old columns while the signed-notes migration is not applied. */
async function readThreads(path: (select: string) => string): Promise<Row[]> {
  const current = select();
  try {
    return await rest<Row[]>(path(current));
  } catch (error) {
    // 42703 = undefined column (Postgres), as relayed by PostgREST.
    if (current === SELECT_SIGNED && error instanceof SayError && error.code === "42703") {
      legacyUntil = Date.now() + 5 * 60_000;
      return rest<Row[]>(path(SELECT_LEGACY));
    }
    throw error;
  }
}

const stored = (row: Signed) => ({ signer: row.signer ?? null, signature: row.signature ?? null, payload: row.signed_payload ?? null });

async function toThread(row: Row): Promise<SayThreadData> {
  const replies = await Promise.all(
    row.say_replies.map(async (reply) => ({
      id: reply.id,
      parentId: reply.parent_id,
      author: reply.author,
      body: reply.body,
      createdAt: reply.created_at,
      proof: await checkStored(stored(reply), { kind: "reply", thread: row.id, parent: reply.parent_id ?? "", title: "", text: reply.body, author: reply.author }),
    })),
  );
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    author: row.author,
    createdAt: row.created_at,
    slugs: row.say_links.map((link) => link.restaurant_slug),
    replies: replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    proof: await checkStored(stored(row), { kind: "thread", thread: "", parent: "", title: row.title, text: row.body, author: row.author }),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isThreadId = (value: string) => UUID.test(value);

export async function listThreads({ slug, limit = 100 }: { slug?: string; limit?: number } = {}) {
  const pg = await postgres();
  if (pg) return Promise.all((await pg.listRows({ slug, limit })).map(toThread));
  // A restaurant page asks for the conversations linked to it; !inner keeps only those.
  const filter = slug ? `&say_links.restaurant_slug=eq.${encodeURIComponent(slug)}` : "";
  const rows = await readThreads((columns) => {
    const chosen = slug ? columns.replace("say_links(restaurant_slug)", "say_links!inner(restaurant_slug)") : columns;
    return `say_threads?select=${chosen}${filter}&order=created_at.desc&limit=${limit}`;
  });
  const threads = await Promise.all(rows.map(toThread));
  // The !inner filter trims say_links to the matching slug; fetch full links for those threads.
  if (slug && threads.length) {
    const links = await rest<Array<{ thread_id: string; restaurant_slug: string }>>(
      `say_links?select=thread_id,restaurant_slug&thread_id=in.(${threads.map((thread) => thread.id).join(",")})`,
    );
    for (const thread of threads) thread.slugs = links.filter((link) => link.thread_id === thread.id).map((link) => link.restaurant_slug);
  }
  return threads;
}

export async function getThread(id: string) {
  if (!isThreadId(id)) return null;
  const pg = await postgres();
  if (pg) {
    const row = await pg.getRow(id);
    return row ? toThread(row) : null;
  }
  const rows = await readThreads((columns) => `say_threads?select=${columns}&id=eq.${id}`);
  return rows[0] ? toThread(rows[0]) : null;
}

/** Thrown when a signed post arrives before the signed-notes migration is applied. */
export const SIGNING_UNAVAILABLE = "signing unavailable";

/** Signed calls need the functions from 20261101000000_signed_notes.sql; PGRST202 = function not found. */
async function rpc(name: "say_post" | "say_reply", args: Record<string, unknown>, proof: NoteProof | null) {
  const pg = await postgres();
  if (pg) return pg.call(name, Object.values(args), proof);
  const body = proof ? { ...args, p_signer: proof.signer, p_signature: proof.signature, p_payload: proof.payload } : args;
  try {
    return await rest<string>(`rpc/${proof ? `${name}_signed` : name}`, { method: "POST", body: JSON.stringify(body) });
  } catch (error) {
    if (proof && error instanceof SayError && error.code === "PGRST202") throw new Error(SIGNING_UNAVAILABLE);
    throw error;
  }
}

export async function createThread(input: { author: string; title: string; body: string; slug: string | null }, proof: NoteProof | null = null) {
  return rpc("say_post", { p_author: input.author, p_title: input.title, p_body: input.body, p_slug: input.slug }, proof);
}

export async function createReply(input: { threadId: string; parentId: string | null; author: string; body: string }, proof: NoteProof | null = null) {
  return rpc("say_reply", { p_thread: input.threadId, p_parent: input.parentId, p_author: input.author, p_body: input.body }, proof);
}
