import "server-only";

// Say storage: the MesaSay Supabase project, reached over its REST API with the public key.
// That key can only read published posts and call say_post / say_reply (see supabase/say/*.sql).

export type SayReply = { id: string; parentId: string | null; author: string; body: string; createdAt: string };
export type SayThreadData = {
  id: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  slugs: string[];
  replies: SayReply[];
};

type Row = {
  id: string;
  title: string;
  body: string;
  author: string;
  created_at: string;
  say_links: Array<{ restaurant_slug: string }>;
  say_replies: Array<{ id: string; parent_id: string | null; author: string; body: string; created_at: string }>;
};

const SELECT = "id,title,body,author,created_at,say_links(restaurant_slug),say_replies(id,parent_id,author,body,created_at)";

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
    const message = (() => {
      try {
        return JSON.parse(text).message as string;
      } catch {
        return text;
      }
    })();
    throw new Error(message || `Say request failed (${response.status})`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

function toThread(row: Row): SayThreadData {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    author: row.author,
    createdAt: row.created_at,
    slugs: row.say_links.map((link) => link.restaurant_slug),
    replies: row.say_replies
      .map((reply) => ({ id: reply.id, parentId: reply.parent_id, author: reply.author, body: reply.body, createdAt: reply.created_at }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isThreadId = (value: string) => UUID.test(value);

export async function listThreads({ slug, limit = 100 }: { slug?: string; limit?: number } = {}) {
  // A restaurant page asks for the conversations linked to it; !inner keeps only those.
  const select = slug ? SELECT.replace("say_links(restaurant_slug)", "say_links!inner(restaurant_slug)") : SELECT;
  const filter = slug ? `&say_links.restaurant_slug=eq.${encodeURIComponent(slug)}` : "";
  const rows = await rest<Row[]>(`say_threads?select=${select}${filter}&order=created_at.desc&limit=${limit}`);
  const threads = rows.map(toThread);
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
  const rows = await rest<Row[]>(`say_threads?select=${SELECT}&id=eq.${id}`);
  return rows[0] ? toThread(rows[0]) : null;
}

export async function createThread(input: { author: string; title: string; body: string; slug: string | null }) {
  return rest<string>("rpc/say_post", {
    method: "POST",
    body: JSON.stringify({ p_author: input.author, p_title: input.title, p_body: input.body, p_slug: input.slug }),
  });
}

export async function createReply(input: { threadId: string; parentId: string | null; author: string; body: string }) {
  return rest<string>("rpc/say_reply", {
    method: "POST",
    body: JSON.stringify({ p_thread: input.threadId, p_parent: input.parentId, p_author: input.author, p_body: input.body }),
  });
}
