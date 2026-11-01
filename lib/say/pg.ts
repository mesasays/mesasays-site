import "server-only";

import { Pool } from "pg";
import type { NoteProof } from "@/lib/say/signature";

// Say storage on our own Postgres (infra/postgres/schema.sql), used when SAY_BACKEND=postgres.
// DATABASE_URL logs in as mesasays_app: it can read published rows and call the say_* functions,
// nothing else. It returns rows in the same shape as the Supabase REST API, so lib/say/db.ts
// turns both into threads the same way (and re-checks every stored signature on read).

const globalPool = globalThis as unknown as { __mesasaysSayPool?: Pool };

function pool() {
  if (!globalPool.__mesasaysSayPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("Say is not configured: DATABASE_URL missing (SAY_BACKEND=postgres)");
    globalPool.__mesasaysSayPool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }
  return globalPool.__mesasaysSayPool;
}

async function query<T>(text: string, values: unknown[] = []): Promise<T[]> {
  const result = await pool().query(text, values);
  return result.rows as T[];
}

type Signed = { signer: string | null; signature: string | null; signed_payload: unknown };
export type PgReplyRow = Signed & { id: string; parent_id: string | null; author: string; body: string; created_at: string };
export type PgThreadRow = Signed & {
  id: string;
  title: string;
  body: string;
  author: string;
  created_at: string;
  say_links: Array<{ restaurant_slug: string }>;
  say_replies: PgReplyRow[];
};

// One round trip per list: each thread with its links and published replies as JSON arrays.
const THREADS_SQL = `
  select t.id, t.title, t.body, t.author, to_json(t.created_at) #>> '{}' as created_at,
    t.signer, t.signature, t.signed_payload,
    coalesce((select json_agg(json_build_object('restaurant_slug', l.restaurant_slug) order by l.created_at)
      from say_links l where l.thread_id = t.id), '[]') as say_links,
    coalesce((
      select json_agg(json_build_object(
        'id', r.id, 'parent_id', r.parent_id, 'author', r.author, 'body', r.body, 'created_at', r.created_at,
        'signer', r.signer, 'signature', r.signature, 'signed_payload', r.signed_payload
      ) order by r.created_at)
      from say_replies r where r.thread_id = t.id and r.status = 'published'
    ), '[]') as say_replies
  from say_threads t
  where t.status = 'published'`;

export async function listRows({ slug, limit = 100 }: { slug?: string; limit?: number } = {}) {
  return slug
    ? query<PgThreadRow>(
        `${THREADS_SQL} and exists (select 1 from say_links l where l.thread_id = t.id and l.restaurant_slug = $1)
         order by t.created_at desc limit $2`,
        [slug, limit],
      )
    : query<PgThreadRow>(`${THREADS_SQL} order by t.created_at desc limit $1`, [limit]);
}

export async function getRow(id: string) {
  const rows = await query<PgThreadRow>(`${THREADS_SQL} and t.id = $1`, [id]);
  return rows[0] ?? null;
}

/** Same functions and arguments as the Supabase RPC calls (supabase/say/*.sql). */
export async function call(name: "say_post" | "say_reply", args: unknown[], proof: NoteProof | null) {
  const values = proof ? [...args, proof.signer, proof.signature, JSON.stringify(proof.payload)] : args;
  const fn = proof ? `${name}_signed` : name;
  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await query<{ id: string }>(`select ${fn}(${placeholders}) as id`, values);
  return rows[0].id;
}

/** For tests and scripts: close the pool so the process can exit. */
export async function closeSayPool() {
  await globalPool.__mesasaysSayPool?.end();
  globalPool.__mesasaysSayPool = undefined;
}
