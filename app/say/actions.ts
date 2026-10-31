"use server";

import { revalidatePath } from "next/cache";
import { getRestaurantBySlug } from "@/lib/data";
import { createReply, createThread, isThreadId } from "@/lib/say/db";

export type SayResult = { ok: true; id: string } | { ok: false; error: string };

const cleanName = (value: string) => value.replace(/[^\p{L}\p{N}_.]/gu, "").slice(0, 20);

/** First line (or sentence) becomes the headline, the rest stays as details. */
function splitPost(text: string) {
  const clean = text.trim();
  const lineBreak = clean.indexOf("\n");
  const sentence = clean.search(/[.?!](\s|$)/);
  let cut = lineBreak >= 0 ? lineBreak : sentence >= 0 ? sentence + 1 : clean.length;
  if (cut > 140) cut = clean.lastIndexOf(" ", 140) > 40 ? clean.lastIndexOf(" ", 140) : 140;
  return { title: clean.slice(0, cut).trim(), body: clean.slice(cut).trim() };
}

function failure(error: unknown): SayResult {
  const message = error instanceof Error ? error.message : "";
  return { ok: false, error: message.includes("too many") ? "Lots of people talking right now, try again in a minute." : "That didn't go through. Try again." };
}

export async function postThread(input: { author: string; text: string; slug: string | null; website?: string }): Promise<SayResult> {
  // "website" is a field people never see: only bots fill it in.
  if (input.website) return { ok: false, error: "That didn't go through. Try again." };
  const author = cleanName(input.author);
  const text = input.text.trim();
  if (!author) return { ok: false, error: "Pick a name first." };
  if (text.length < 8) return { ok: false, error: "Say a bit more." };
  if (text.length > 4000) return { ok: false, error: "That's long. Keep it under 4,000 characters." };
  const slug = input.slug && (await getRestaurantBySlug(input.slug)) ? input.slug : null;
  let { title, body } = splitPost(text);
  if (title.length < 8) {
    title = text.slice(0, 140);
    body = text.slice(140);
  }
  try {
    const id = await createThread({ author, title, body, slug });
    revalidatePath("/say");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

export async function postReply(input: { threadId: string; parentId: string | null; author: string; body: string; website?: string }): Promise<SayResult> {
  if (input.website) return { ok: false, error: "That didn't go through. Try again." };
  const author = cleanName(input.author);
  const body = input.body.trim();
  if (!author) return { ok: false, error: "Pick a name first." };
  if (body.length < 2 || body.length > 4000) return { ok: false, error: "Replies are 2 to 4,000 characters." };
  if (!isThreadId(input.threadId) || (input.parentId && !isThreadId(input.parentId))) return { ok: false, error: "That conversation is gone." };
  try {
    const id = await createReply({ threadId: input.threadId, parentId: input.parentId, author, body });
    revalidatePath(`/say/${input.threadId}`);
    revalidatePath("/say");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}
