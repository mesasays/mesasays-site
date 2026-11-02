import { readRelayed, SAY_TOPIC, castKey, isSayTopic, parseCastKey, slugFromTopic, topicUrl, type CastView } from "../relayed.ts";
import { splitPost } from "../signature.ts";
import type { SayCastRef, SayReply, SaySource, SayThreadData } from "../types.ts";
import { castById, castsByFid, castsByTopic, castText, farcasterTimeToIso, profile, repliesTo, type HubMessage } from "./hub.ts";
import { verifyHubMessage } from "./message.ts";

// Conversations read straight from public Farcaster hubs and turned into what the Say pages show.
// Nothing is stored on our side: the hub answer is cached for 30 s by Next.js and that is all.
// No "@/" imports and no server-only code: the hub test in scripts/test-say-farcaster.mjs runs it in Node.

export type ReadConfig = {
  /** The MesaSays account: its casts are relayed / migrated notes, checked against their proofs. */
  mesasaysFid: number | null;
  /** Sites a passkey proof may come from. */
  origins: string[];
  hubs?: string[];
  /**
   * The /mesasays channel's parent URL, once Jules has created it (SAY_FARCASTER_CHANNEL_URL). People post there
   * from any Farcaster app; a post that links a restaurant page shows on that restaurant.
   */
  channel?: string | null;
  /**
   * The MesaSays account's app key (public, hex). When set, a cast from mesasaysFid must be signed by it:
   * a dishonest hub could otherwise sign a fake "MesaSays" cast with a key of its own.
   */
  mesasaysSigner?: string | null;
};

/** Restaurant pages a cast links to (embeds or text), English or Spanish URL. */
const PAGE = /https?:\/\/(?:www\.)?mesasays\.com\/(?:es\/restaurantes|restaurants)\/([a-z0-9-]{1,80})/gi;
export function linkedSlugs(message: HubMessage): string[] {
  const body = message.data.castAddBody ?? {};
  const sources = [...(body.embeds ?? []).map((embed) => embed.url ?? ""), body.text ?? ""];
  return [...new Set(sources.flatMap((source) => [...source.matchAll(PAGE)].map((match) => match[1].toLowerCase())))];
}

/** A conversation of ours: posted on a Say topic (general or a restaurant) or in the /mesasays channel. */
export function isOurs(message: HubMessage, config: ReadConfig) {
  const body = message.data.castAddBody;
  if (!body || body.parentCastId) return false;
  return isSayTopic(body.parentUrl) || Boolean(config.channel && body.parentUrl === config.channel);
}

/**
 * Only messages whose hash and signature check out are shown, so a hub cannot alter a post. That the key
 * belongs to the account is checked by hubs against the Optimism key registry, and here too for MesaSays.
 */
async function verified(messages: HubMessage[], config?: ReadConfig) {
  const ours = config?.mesasaysSigner?.toLowerCase() ?? null;
  const checks = await mapLimit(messages, 8, async (message) => {
    if (ours && config?.mesasaysFid && message.data.fid === config.mesasaysFid && message.signer?.toLowerCase() !== ours) return false;
    return verifyHubMessage(message);
  });
  return messages.filter((_, index) => checks[index]);
}

const MAX_DEPTH = 3;
const MAX_REPLIES = 150;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        out[index] = await fn(items[index]);
      }
    }),
  );
  return out;
}

const view = (message: HubMessage): CastView => {
  const body = message.data.castAddBody ?? {};
  return {
    fid: message.data.fid,
    hash: message.hash,
    text: body.text ?? "",
    embeds: (body.embeds ?? []).map((embed) => embed.url).filter((url): url is string => Boolean(url)),
    parentUrl: body.parentUrl ?? null,
    parentCastId: body.parentCastId ?? null,
  };
};

type Post = { author: string; title: string; body: string; createdAt: string; proof: SayReply["proof"]; source: SaySource; cast: SayCastRef };

async function names(messages: HubMessage[], hubs?: string[]) {
  const fids = [...new Set(messages.flatMap((message) => [message.data.fid, ...(message.data.castAddBody?.mentions ?? [])]))];
  const profiles = await mapLimit(fids, 8, async (fid) => [fid, await profile(fid, hubs)] as const);
  return new Map(profiles);
}

async function toPost(message: HubMessage, people: Map<number, { username: string | null; display: string | null }>, config: ReadConfig, asThread: boolean): Promise<Post> {
  const cast = view(message);
  const person = people.get(cast.fid);
  const ref: SayCastRef = { fid: cast.fid, hash: cast.hash, username: person?.username ?? null };
  const createdAt = farcasterTimeToIso(message.data.timestamp);
  if (config.mesasaysFid && cast.fid === config.mesasaysFid) {
    const read = await readRelayed(cast, config.origins);
    if (read?.kind === "relayed") {
      const title = asThread ? read.title : "";
      const body = asThread ? read.text : read.title ? `${read.title}\n${read.text}` : read.text;
      return { author: read.author, title, body, createdAt, proof: read.proof, source: { kind: "relayed" }, cast: ref };
    }
    if (read?.kind === "migrated") {
      const title = asThread ? read.title : "";
      const body = asThread ? read.text : read.title ? `${read.title}\n${read.text}` : read.text;
      return { author: read.author, title, body, createdAt: `${read.date}T12:00:00.000Z`, proof: null, source: { kind: "migrated", date: read.date, signer: read.signer, archive: read.archive }, cast: ref };
    }
  }
  const usernames = new Map([...people].map(([fid, value]) => [fid, value.username]));
  let text = castText(message.data.castAddBody ?? {}, usernames).trim();
  if (!text) text = cast.embeds.join("\n");
  const author = person?.username ? `@${person.username}` : person?.display || `fid:${cast.fid}`;
  const source: SaySource = config.mesasaysFid && cast.fid === config.mesasaysFid ? { kind: "team" } : { kind: "farcaster" };
  if (!asThread) return { author, title: "", body: text, createdAt, proof: null, source, cast: ref };
  const { title, body } = splitPost(text);
  return { author, title: title || "(no text)", body, createdAt, proof: null, source, cast: ref };
}

/** Every reply under a cast, down to three levels, each with its parent's id. */
async function replyTree(root: HubMessage, hubs?: string[], config?: ReadConfig) {
  const found: Array<{ message: HubMessage; parentId: string | null }> = [];
  let level = [root];
  for (let depth = 0; depth < MAX_DEPTH && level.length && found.length < MAX_REPLIES; depth += 1) {
    const children = await mapLimit(level, 6, async (parent) => {
      const replies = await repliesTo(parent.data.fid, parent.hash, hubs).catch(() => []);
      // A reply to the root has no parent reply (parentId null), as in the database backends.
      const parentId = parent === root ? null : castKey(parent.data.fid, parent.hash);
      return replies.map((message) => ({ message, parentId }));
    });
    const all = children.flat();
    const ok = new Set(await verified(all.map((item) => item.message), config));
    const next = all.filter((item) => ok.has(item.message)).slice(0, MAX_REPLIES - found.length);
    found.push(...next);
    level = next.map((item) => item.message);
  }
  return found;
}

async function toThread(root: HubMessage, config: ReadConfig): Promise<SayThreadData> {
  const tree = await replyTree(root, config.hubs, config);
  const people = await names([root, ...tree.map((item) => item.message)], config.hubs);
  const post = await toPost(root, people, config, true);
  const replies: SayReply[] = await Promise.all(
    tree.map(async ({ message, parentId }) => {
      const reply = await toPost(message, people, config, false);
      return { id: castKey(message.data.fid, message.hash), parentId, author: reply.author, body: reply.body, createdAt: reply.createdAt, proof: reply.proof, source: reply.source, cast: reply.cast };
    }),
  );
  const topic = root.data.castAddBody?.parentUrl ?? undefined;
  const slug = slugFromTopic(topic);
  const slugs = [...new Set([...(slug ? [slug] : []), ...linkedSlugs(root)])];
  return {
    id: castKey(root.data.fid, root.hash),
    title: post.title,
    body: post.body,
    author: post.author,
    createdAt: post.createdAt,
    slugs,
    replies: replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    proof: post.proof,
    source: post.source,
    cast: post.cast,
    topic,
  };
}

/**
 * A restaurant's conversations (its topic), or with no slug the feed: the general topic plus every
 * conversation the MesaSays account relayed onto any restaurant topic. Native casts on a restaurant
 * topic show on that restaurant's page (the feed would need one hub call per restaurant).
 */
export async function listFarcasterThreads({ slug, limit = 50 }: { slug?: string; limit?: number }, config: ReadConfig): Promise<SayThreadData[]> {
  let roots: HubMessage[];
  // The channel is read for both views; a restaurant only keeps the channel posts that link to it.
  const channel = config.channel ? castsByTopic(config.channel, 3, config.hubs).catch(() => []) : Promise.resolve([]);
  if (slug) {
    const [own, fromChannel] = await Promise.all([castsByTopic(topicUrl(slug), 3, config.hubs), channel]);
    roots = [...own, ...fromChannel.filter((message) => linkedSlugs(message).includes(slug))];
  } else {
    const [general, relayed, fromChannel] = await Promise.all([
      castsByTopic(SAY_TOPIC, 3, config.hubs),
      config.mesasaysFid ? castsByFid(config.mesasaysFid, 100, config.hubs).catch(() => []) : Promise.resolve([]),
      channel,
    ]);
    roots = [...general, ...relayed.filter((message) => isSayTopic(message.data.castAddBody?.parentUrl)), ...fromChannel];
  }
  roots = await verified(roots.filter((message) => isOurs(message, config)), config);
  const unique = [...new Map(roots.map((message) => [message.hash, message])).values()]
    .sort((a, b) => b.data.timestamp - a.data.timestamp)
    .slice(0, limit);
  return mapLimit(unique, 4, (root) => toThread(root, config));
}

export async function getFarcasterThread(id: string, config: ReadConfig): Promise<SayThreadData | null> {
  const key = parseCastKey(id);
  if (!key) return null;
  const root = await castById(key.fid, key.hash, config.hubs);
  // Anything else on Farcaster must not render as a MesaSays page, and a forged message not at all.
  if (!root || !isOurs(root, config) || !(await verified([root], config)).length) return null;
  return toThread(root, config);
}
