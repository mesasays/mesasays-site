// Public Farcaster hubs (Snapchain nodes) over their HTTP API. Reading needs no key and no account.
//
// SAY_FARCASTER_HUBS = comma-separated base URLs, tried in order (a hub that answers moves first).
// Default: Quilibrium's public node only. The two nodes run by the Farcaster company (crackle / snap
// .farcaster.xyz) work but are left out on purpose: Jules' rule is "no centralized US service, not even as
// a fallback". A second independent hub (ours, in the EU) is the planned fallback; add it here when it runs.
// Neynar's endpoints need an API key or a payment: not used.
// No "@/" imports: scripts/test-say-farcaster.mjs runs this file in Node.

export const DEFAULT_HUBS = ["https://haatz.quilibrium.com"];

export function hubList(env: string | undefined = typeof process !== "undefined" ? process.env.SAY_FARCASTER_HUBS : undefined): string[] {
  const list = (env ?? "")
    .split(",")
    .map((url) => url.trim().replace(/\/$/, ""))
    .filter((url) => /^https?:\/\//.test(url));
  return list.length ? list : DEFAULT_HUBS;
}

export class HubUnavailable extends Error {
  attempts: string[];
  constructor(attempts: string[]) {
    super(`No Farcaster hub answered: ${attempts.join("; ")}`);
    this.attempts = attempts;
  }
}

let preferred: string | null = null;
const ordered = (hubs: string[]) => (preferred && hubs.includes(preferred) ? [preferred, ...hubs.filter((hub) => hub !== preferred)] : hubs);

/** Seconds a hub answer may be reused by the Next.js data cache (in Node scripts the option is ignored). */
export const HUB_REVALIDATE = 30;
export const HUB_TAG = "say-farcaster";

/**
 * GET a hub path ("/v1/castsByParent?..."), trying each hub with a short timeout. A 4xx answer is a real
 * answer (bad request, not found) and is returned as null instead of trying elsewhere.
 */
export async function hubGet<T>(path: string, options: { hubs?: string[]; timeoutMs?: number; revalidate?: number } = {}): Promise<T | null> {
  const attempts: string[] = [];
  for (const hub of ordered(options.hubs ?? hubList())) {
    try {
      const response = await fetch(`${hub}${path}`, {
        signal: AbortSignal.timeout(options.timeoutMs ?? 3500),
        headers: { accept: "application/json" },
        next: { revalidate: options.revalidate ?? HUB_REVALIDATE, tags: [HUB_TAG] },
      } as RequestInit);
      if (response.status >= 400 && response.status < 500) {
        preferred = hub;
        return null;
      }
      if (!response.ok) {
        attempts.push(`${hub}: HTTP ${response.status}`);
        continue;
      }
      const json = (await response.json()) as T;
      preferred = hub;
      return json;
    } catch (error) {
      attempts.push(`${hub}: ${error instanceof Error ? error.message : "error"}`);
    }
  }
  throw new HubUnavailable(attempts);
}

/**
 * POST an encoded Farcaster message (protobuf bytes) to /v1/submitMessage. Public hubs accept writes
 * without a key (checked 2026-11-01 on all three defaults: an empty message reaches validation and is
 * refused with "fid cannot be 0", never 401). Stops at the first hub that accepts the message.
 */
export async function hubSubmit(bytes: Uint8Array, hubs: string[] = hubList()): Promise<{ hub: string; body: unknown }> {
  const attempts: string[] = [];
  for (const hub of ordered(hubs)) {
    try {
      const response = await fetch(`${hub}/v1/submitMessage`, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: bytes as unknown as BodyInit,
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      const text = await response.text();
      if (response.ok) return { hub, body: text ? JSON.parse(text) : null };
      attempts.push(`${hub}: HTTP ${response.status} ${text.slice(0, 200)}`);
      // A validation error will be the same everywhere: do not spray an invalid message.
      if (response.status === 400 && !/duplicate|already/i.test(text)) break;
    } catch (error) {
      attempts.push(`${hub}: ${error instanceof Error ? error.message : "error"}`);
    }
  }
  throw new HubUnavailable(attempts);
}

/* ---------- hub JSON ---------- */

export type HubCastAddBody = {
  text?: string;
  embeds?: Array<{ url?: string; castId?: { fid: number; hash: string } }>;
  mentions?: number[];
  mentionsPositions?: number[];
  parentUrl?: string | null;
  parentCastId?: { fid: number; hash: string } | null;
  type?: string;
};
export type HubMessage = {
  data: { type: string; fid: number; timestamp: number; network?: string; castAddBody?: HubCastAddBody; userDataBody?: { type: string; value: string } };
  hash: string;
  hashScheme?: string;
  signature?: string;
  signatureScheme?: string;
  signer?: string;
};
type Page = { messages: HubMessage[]; nextPageToken?: string };

/** Farcaster timestamps are seconds since 2021-01-01T00:00:00Z. */
export const FARCASTER_EPOCH_MS = 1_609_459_200_000;
export const farcasterTimeToIso = (timestamp: number) => new Date(FARCASTER_EPOCH_MS + timestamp * 1000).toISOString();

const isCast = (message: HubMessage) => message.data?.type === "MESSAGE_TYPE_CAST_ADD" && Boolean(message.data.castAddBody);

async function pages(path: string, maxPages: number, hubs?: string[]): Promise<HubMessage[]> {
  const out: HubMessage[] = [];
  let token = "";
  for (let page = 0; page < maxPages; page += 1) {
    const result = await hubGet<Page>(`${path}&pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`, { hubs });
    if (!result) break;
    out.push(...result.messages.filter(isCast));
    if (!result.nextPageToken || result.messages.length < 100) break;
    token = result.nextPageToken;
  }
  return out;
}

/**
 * Top-level casts under a topic URL, newest first, up to maxPages × 100. (Checked 2026-11-01 on haatz:
 * reverse=true works for https:// and chain:// topics. The old /food channel answers nothing either way,
 * a hub-side quirk with that topic, which is what an earlier note here mistook for reverse being broken.)
 */
export const castsByTopic = (url: string, maxPages = 3, hubs?: string[]) => pages(`/v1/castsByParent?url=${encodeURIComponent(url)}&reverse=true`, maxPages, hubs);

/** Direct replies to a cast. */
export const repliesTo = (fid: number, hash: string, hubs?: string[]) => pages(`/v1/castsByParent?fid=${fid}&hash=${hash}`, 2, hubs);

/** A user's latest casts, newest first. */
export async function castsByFid(fid: number, limit = 100, hubs?: string[]) {
  const result = await hubGet<Page>(`/v1/castsByFid?fid=${fid}&pageSize=${Math.min(limit, 100)}&reverse=true`, { hubs });
  return (result?.messages ?? []).filter(isCast);
}

export async function castById(fid: number, hash: string, hubs?: string[]) {
  const result = await hubGet<HubMessage>(`/v1/castById?fid=${fid}&hash=${hash}`, { hubs });
  return result && isCast(result) ? result : null;
}

/** Username and display name of a fid (cached for an hour). */
export async function profile(fid: number, hubs?: string[]): Promise<{ username: string | null; display: string | null }> {
  try {
    const result = await hubGet<Page>(`/v1/userDataByFid?fid=${fid}`, { hubs, revalidate: 3600 });
    const value = (type: string) => result?.messages.find((message) => message.data.userDataBody?.type === type)?.data.userDataBody?.value ?? null;
    return { username: value("USER_DATA_TYPE_USERNAME"), display: value("USER_DATA_TYPE_DISPLAY") };
  } catch {
    return { username: null, display: null };
  }
}

/** Cast text with its mentions put back (hubs store "@name" as a fid and a byte position). */
export function castText(body: HubCastAddBody, names: Map<number, string | null>) {
  const text = body.text ?? "";
  const mentions = body.mentions ?? [];
  const positions = body.mentionsPositions ?? [];
  if (!mentions.length) return text;
  const bytes = new TextEncoder().encode(text);
  const decoder = new TextDecoder();
  let out = "";
  let last = 0;
  mentions.forEach((fid, index) => {
    const at = positions[index] ?? last;
    out += decoder.decode(bytes.slice(last, at)) + `@${names.get(fid) ?? `fid:${fid}`}`;
    last = at;
  });
  return out + decoder.decode(bytes.slice(last));
}
