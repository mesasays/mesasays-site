"use server";

import { revalidatePath } from "next/cache";
import { getRestaurantBySlug } from "@/lib/data";
import { SIGNING_UNAVAILABLE, createReply, createThread, isThreadId } from "@/lib/say/db";
import { prepareReply, prepareThread, type SignedInput } from "@/lib/say/signature";

export type SayResult = { ok: true; id: string } | { ok: false; error: string };

const nowSeconds = () => Math.floor(Date.now() / 1000);

function failure(error: unknown): SayResult {
  const message = error instanceof Error ? error.message : "";
  if (message === SIGNING_UNAVAILABLE) return { ok: false, error: "Signed posts aren't switched on yet. Untick “Sign with wallet” to post now." };
  return { ok: false, error: message.includes("too many") ? "Lots of people talking right now, try again in a minute." : "That didn't go through. Try again." };
}

// Both actions can be called by anyone with a POST: everything is checked again here, signatures included
// (rebuilt from the exact fields we store, see lib/say/signature.ts).

export async function postThread(input: { author: string; text: string; slug: string | null; website?: string; signed?: SignedInput | null }): Promise<SayResult> {
  // "website" is a field people never see: only bots fill it in.
  if (input.website) return { ok: false, error: "That didn't go through. Try again." };
  const prepared = await prepareThread(input, { placeExists: async (slug) => Boolean(await getRestaurantBySlug(slug)), now: nowSeconds() });
  if (!prepared.ok) return prepared;
  try {
    const id = await createThread(prepared.post, prepared.proof);
    revalidatePath("/say");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

export async function postReply(input: { threadId: string; parentId: string | null; author: string; body: string; website?: string; signed?: SignedInput | null }): Promise<SayResult> {
  if (input.website) return { ok: false, error: "That didn't go through. Try again." };
  const prepared = await prepareReply(input, { isId: isThreadId, now: nowSeconds() });
  if (!prepared.ok) return prepared;
  try {
    const id = await createReply(prepared.post, prepared.proof);
    revalidatePath(`/say/${input.threadId}`);
    revalidatePath("/say");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}
