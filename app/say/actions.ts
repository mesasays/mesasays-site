"use server";

import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { getRestaurantBySlug } from "@/lib/data";
import { SIGNING_UNAVAILABLE, createReply, createThread, isThreadId } from "@/lib/say/db";
import { farcasterSettings, isFarcasterBackend } from "@/lib/say/farcaster/config";
import { HUB_TAG } from "@/lib/say/farcaster/hub";
import { relayReply, relayThread } from "@/lib/say/farcaster/relay";
import { prepareReply, prepareThread, type Eip712Proof, type NoteProof, type SignedInput } from "@/lib/say/signature";
import type { SayResult } from "@/lib/say/types";

export type { SayResult } from "@/lib/say/types";

const nowSeconds = () => Math.floor(Date.now() / 1000);

function failure(error: unknown): SayResult {
  const message = error instanceof Error ? error.message : "";
  if (message === SIGNING_UNAVAILABLE) return { ok: false, error: "Signed posts aren't switched on yet. Untick “Sign with wallet” to post now." };
  return { ok: false, error: message.includes("too many") ? "Lots of people talking right now, try again in a minute." : "That didn't go through. Try again." };
}

/** The database backends store wallet signatures only. */
const walletOnly = (proof: NoteProof | null): Eip712Proof | null => (proof?.method === "eip712" ? proof : null);

async function clientIp() {
  const list = (await headers()).get("x-forwarded-for") ?? "";
  return list.split(",")[0]?.trim() || "unknown";
}

/** Signature rules per backend: Farcaster accepts passkeys and, unless switched on, refuses unsigned posts. */
function rules() {
  if (!isFarcasterBackend()) return { now: nowSeconds() };
  const settings = farcasterSettings();
  return { now: nowSeconds(), origins: settings.origins, requireSignature: !settings.allowUnsigned };
}

// Both actions can be called by anyone with a POST: everything is checked again here, signatures included
// (rebuilt from the exact fields we store or publish, see lib/say/signature.ts).

export async function postThread(input: { author: string; text: string; slug: string | null; website?: string; signed?: SignedInput | null }): Promise<SayResult> {
  // "website" is a field people never see: only bots fill it in.
  if (input.website) return { ok: false, error: "That didn't go through. Try again." };
  const prepared = await prepareThread(input, { ...rules(), placeExists: async (slug) => Boolean(await getRestaurantBySlug(slug)) });
  if (!prepared.ok) return prepared;
  if (isFarcasterBackend()) {
    const result = await relayThread(prepared.post, prepared.proof, await clientIp());
    if (result.ok && !result.dryRun) updateTag(HUB_TAG);
    return result;
  }
  try {
    const id = await createThread(prepared.post, walletOnly(prepared.proof));
    revalidatePath("/say");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

export async function postReply(input: { threadId: string; parentId: string | null; author: string; body: string; website?: string; signed?: SignedInput | null }): Promise<SayResult> {
  if (input.website) return { ok: false, error: "That didn't go through. Try again." };
  const prepared = await prepareReply(input, { ...rules(), isId: isThreadId });
  if (!prepared.ok) return prepared;
  if (isFarcasterBackend()) {
    const result = await relayReply(prepared.post, prepared.proof, await clientIp());
    if (result.ok && !result.dryRun) updateTag(HUB_TAG);
    return result;
  }
  try {
    const id = await createReply(prepared.post, walletOnly(prepared.proof));
    revalidatePath(`/say/${input.threadId}`);
    revalidatePath("/say");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}
