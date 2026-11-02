import "server-only";

import { randomBytes } from "node:crypto";
import { farcasterSettings } from "@/lib/say/farcaster/config";
import { castById, FARCASTER_EPOCH_MS, hubSubmit, HubUnavailable } from "@/lib/say/farcaster/hub";
import { createLimiter, relayRules } from "@/lib/say/farcaster/limits";
import { buildCast, verifyHubMessage } from "@/lib/say/farcaster/message";
import { isOurs } from "@/lib/say/farcaster/read";
import { LONG_CAST_BYTES, castKey, parseCastKey, relayedCast, topicUrl } from "@/lib/say/relayed";
import { noteDigest, replyNote, threadNote, type Note, type NoteProof } from "@/lib/say/signature";
import type { SayResult } from "@/lib/say/types";

// The relay: a note written on mesasays.com, already checked (text rules + signature) by
// lib/say/signature.ts, becomes one cast from the MesaSays Farcaster account under the right topic.
// Dry run (default) builds and validates the exact message, then stops: nothing leaves the server.
// Audit 2026-11-01: replies only under verified MesaSays conversations; the cast's timestamp comes from the
// signed note, so one note always gives the same message and hubs refuse a replay; a dry run never signs
// with the real key.

const limiter = createLimiter();

// Dry run without the real key: a throwaway key made when the server starts, never saved, never registered.
let throwaway: string | null = null;
const dryRunKey = () => (throwaway ??= randomBytes(32).toString("hex"));

type Thread = { author: string; title: string; body: string; slug: string | null };
type Reply = { threadId: string; parentId: string | null; author: string; body: string };

async function relay(note: Note, proof: NoteProof | null, target: { parentUrl: string } | { parentCastId: { fid: number; hash: string } }, ip: string): Promise<SayResult> {
  const settings = farcasterSettings();
  if (settings.relay === "off") return { ok: false, error: "Posting is paused for now. You can still reply from any Farcaster app." };
  if (!proof && !settings.allowUnsigned) return { ok: false, error: "Sign your post first (passkey or wallet)." };

  let cast: ReturnType<typeof relayedCast>;
  try {
    cast = relayedCast({ note, proof });
  } catch (error) {
    console.error("say relay: note not packed", error);
    return { ok: false, error: "That post can't be turned into a Farcaster message. Try shorter text." };
  }
  if (cast.bytes > LONG_CAST_BYTES) {
    return { ok: false, error: `That's too long for one Farcaster post: shorten it by about ${cast.bytes - LONG_CAST_BYTES} characters.` };
  }

  if (proof && !limiter.once(noteDigest(note))) return { ok: false, error: "That signed post was already sent." };
  const refused = limiter.take(relayRules({ signer: proof?.signer ?? null, ip, maxPerHour: settings.maxPerHour }));
  if (refused) return { ok: false, error: refused.key.startsWith("all") ? "Lots of people talking right now, try again in a minute." : "You're posting fast: wait a few minutes." };

  const live = settings.relay === "live" && settings.fid && settings.key;
  const fid = settings.fid ?? 1;
  // Farcaster time of the note itself: the same signed note always builds the same message (same hash).
  const timestamp = Math.max(1, Math.floor(note.createdAt - FARCASTER_EPOCH_MS / 1000));
  let built;
  try {
    // A dry run signs with a throwaway key: a message signed by the real key must never leave unsent.
    built = await buildCast({ fid, privateKey: live ? settings.key! : dryRunKey(), text: cast.text, embeds: cast.embeds, timestamp, ...target });
  } catch (error) {
    console.error("say relay: cast not built", error);
    return { ok: false, error: "That post can't be turned into a Farcaster message. Try shorter text." };
  }
  const id = castKey(fid, built.hash);

  if (!live) {
    return {
      ok: true,
      id,
      dryRun: {
        hash: built.hash,
        fid,
        type: built.type,
        bytes: built.bytes.length,
        text: cast.text,
        embeds: cast.embeds,
        parent: "parentUrl" in target ? target.parentUrl : castKey(target.parentCastId.fid, target.parentCastId.hash),
        json: built.json,
        hub: "not sent (dry run, signed with a throwaway key)",
      },
    };
  }
  try {
    await hubSubmit(built.bytes, settings.hubs);
    return { ok: true, id };
  } catch (error) {
    const attempts = error instanceof HubUnavailable ? error.attempts : [String(error)];
    // Same note sent twice (double tap, retry): the hub already has this exact message. It is published.
    if (attempts.some((line) => /duplicate|already (merged|exists)/i.test(line))) return { ok: true, id };
    console.error("say relay: hubs refused", attempts);
    return { ok: false, error: "Farcaster didn't take it. Try again in a minute." };
  }
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export async function relayThread(post: Thread, proof: NoteProof | null, ip: string) {
  // Signed: the note the author signed (rebuilt and verified already). Unsigned: the same fields, now.
  const note = proof ? proof.payload.message : threadNote({ author: post.author, text: post.body ? `${post.title}\n${post.body}` : post.title, place: post.slug, createdAt: nowSeconds() });
  return relay(note, proof, { parentUrl: topicUrl(post.slug) }, ip);
}

const GONE: SayResult = { ok: false, error: "That conversation is gone." };

/**
 * The cast a reply should answer, only if the conversation is a verified MesaSays conversation and the
 * parent (if any) is a reply inside it. Without this, anyone could make the MesaSays account reply under
 * any cast on Farcaster.
 */
async function replyTarget(threadId: string, parentId: string | null): Promise<{ fid: number; hash: string } | SayResult> {
  const settings = farcasterSettings();
  const thread = parseCastKey(threadId);
  if (!thread) return GONE;
  const config = { mesasaysFid: settings.fid, origins: settings.origins, hubs: settings.hubs, channel: settings.channel };
  try {
    const root = await castById(thread.fid, thread.hash, settings.hubs);
    if (!root || !isOurs(root, config) || !(await verifyHubMessage(root))) return GONE;
    if (!parentId) return thread;
    const parent = parseCastKey(parentId);
    if (!parent) return GONE;
    // Walk up from the parent to the conversation (replies are three levels deep at most).
    let current = await castById(parent.fid, parent.hash, settings.hubs);
    for (let depth = 0; current && depth < 4; depth += 1) {
      const up = current.data.castAddBody?.parentCastId;
      if (!up) return GONE;
      if (up.fid === thread.fid && up.hash.toLowerCase() === thread.hash.toLowerCase()) return parent;
      current = await castById(up.fid, up.hash, settings.hubs);
    }
    return GONE;
  } catch (error) {
    console.error("say relay: conversation not checked", error instanceof HubUnavailable ? error.attempts : error);
    return { ok: false, error: "Farcaster is slow right now. Try again in a minute." };
  }
}

export async function relayReply(post: Reply, proof: NoteProof | null, ip: string) {
  const parent = await replyTarget(post.threadId, post.parentId);
  if ("ok" in parent) return parent;
  const note = proof ? proof.payload.message : replyNote({ author: post.author, text: post.body, threadId: post.threadId, parentId: post.parentId, createdAt: nowSeconds() });
  return relay(note, proof, { parentCastId: parent }, ip);
}
