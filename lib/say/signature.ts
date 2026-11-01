import { getAddress, verifyTypedData } from "viem";

// Signed notes: an author can sign a Say post or reply with an Ethereum wallet (EIP-712 typed data:
// free, no transaction, no gas). The signature, not our database, is the proof. The signed payload is
// self-contained so it can be checked by anyone with any EIP-712 tool, and moved elsewhere (Farcaster)
// later without us. Spec and copy-paste verification: docs/SIGNED_NOTES.md.
//
// Shared by the browser (builds what the wallet signs) and the server (rebuilds it and verifies).
// Keep this file free of "@/" imports and of server-only code: scripts/test-signed-notes.mjs runs it in Node.

/** Off-chain statement: no chainId, no verifyingContract, so a signature is not tied to any chain. */
export const NOTE_DOMAIN = { name: "MesaSays", version: "1" } as const;

export const NOTE_TYPES = {
  Note: [
    { name: "kind", type: "string" },
    { name: "place", type: "string" },
    { name: "thread", type: "string" },
    { name: "parent", type: "string" },
    { name: "title", type: "string" },
    { name: "text", type: "string" },
    { name: "author", type: "string" },
    { name: "createdAt", type: "uint256" },
  ],
} as const;

/** The domain's own type, required by eth_signTypedData_v4 and included in the stored JSON. */
export const EIP712_DOMAIN_TYPE = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
] as const;

export type Note = {
  /** "thread" (a new conversation) or "reply". */
  kind: "thread" | "reply";
  /** Restaurant slug the conversation was started from, or "". */
  place: string;
  /** For a reply: the conversation id. "" for a thread. */
  thread: string;
  /** For a reply to a reply: the parent reply id. Otherwise "". */
  parent: string;
  /** Headline of a thread; "" for a reply. */
  title: string;
  /** Body of a thread (may be ""), or the reply text. */
  text: string;
  /** Display name, exactly as shown. */
  author: string;
  /** Unix seconds when the author signed. */
  createdAt: number;
};

/** The exact JSON a wallet signs with eth_signTypedData_v4, and that we store and show. */
export type SignedPayload = {
  types: { EIP712Domain: typeof EIP712_DOMAIN_TYPE; Note: typeof NOTE_TYPES.Note };
  domain: typeof NOTE_DOMAIN;
  primaryType: "Note";
  message: Note;
};

/** What the browser sends next to the post when it is signed. */
export type SignedInput = { signer: string; signature: string; createdAt: number };

/** A verified signature, ready to be stored. */
export type NoteProof = { signer: `0x${string}`; signature: `0x${string}`; payload: SignedPayload };

/** Signature must be within 10 minutes of the server clock when it is posted. */
export const MAX_SKEW_SECONDS = 600;

const NOTE_KEYS = NOTE_TYPES.Note.map((field) => field.name);

export function notePayload(message: Note): SignedPayload {
  // Fixed key order, so the JSON we show is always the same text for the same note.
  const ordered = Object.fromEntries(NOTE_KEYS.map((key) => [key, message[key]])) as Note;
  return {
    types: { EIP712Domain: EIP712_DOMAIN_TYPE, Note: NOTE_TYPES.Note },
    domain: NOTE_DOMAIN,
    primaryType: "Note",
    message: ordered,
  };
}

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/* ---------- what gets posted: same normalisation in the browser and on the server ---------- */

export const cleanName = (value: string) => value.replace(/[^\p{L}\p{N}_.]/gu, "").slice(0, 20);

/** First line (or sentence) becomes the headline, the rest stays as details. Everything is trimmed. */
export function splitPost(text: string) {
  const clean = text.trim();
  const lineBreak = clean.indexOf("\n");
  const sentence = clean.search(/[.?!](\s|$)/);
  let cut = lineBreak >= 0 ? lineBreak : sentence >= 0 ? sentence + 1 : clean.length;
  if (cut > 140) cut = clean.lastIndexOf(" ", 140) > 40 ? clean.lastIndexOf(" ", 140) : 140;
  let title = clean.slice(0, cut).trim();
  let body = clean.slice(cut).trim();
  if (title.length < 8) {
    title = clean.slice(0, 140).trim();
    body = clean.slice(140).trim();
  }
  return { title, body };
}

export function threadNote(input: { author: string; text: string; place: string | null; createdAt: number }): Note {
  const { title, body } = splitPost(input.text);
  return { kind: "thread", place: input.place ?? "", thread: "", parent: "", title, text: body, author: cleanName(input.author), createdAt: input.createdAt };
}

export function replyNote(input: { author: string; text: string; threadId: string; parentId: string | null; createdAt: number }): Note {
  return { kind: "reply", place: "", thread: input.threadId, parent: input.parentId ?? "", title: "", text: input.text.trim(), author: cleanName(input.author), createdAt: input.createdAt };
}

/* ---------- verification ---------- */

export type VerifyResult = { ok: true; proof: NoteProof } | { ok: false; reason: "malformed" | "stale" | "mismatch" };

/**
 * Checks that `signature` is `signer`'s EIP-712 signature of exactly `note`.
 * `now` (unix seconds) turns on the freshness check used when posting; leave it out to check an old note.
 */
export async function verifyNote(note: Note, signed: { signer: string; signature: string }, now?: number): Promise<VerifyResult> {
  let signer: `0x${string}`;
  try {
    signer = getAddress(signed.signer);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof signed.signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signed.signature)) return { ok: false, reason: "malformed" };
  if (!Number.isSafeInteger(note.createdAt) || note.createdAt <= 0) return { ok: false, reason: "malformed" };
  if (now !== undefined && Math.abs(now - note.createdAt) > MAX_SKEW_SECONDS) return { ok: false, reason: "stale" };
  const signature = signed.signature.toLowerCase() as `0x${string}`;
  try {
    const valid = await verifyTypedData({
      address: signer,
      domain: NOTE_DOMAIN,
      types: NOTE_TYPES,
      primaryType: "Note",
      message: { ...note, createdAt: BigInt(note.createdAt) },
      signature,
    });
    return valid ? { ok: true, proof: { signer, signature, payload: notePayload(note) } } : { ok: false, reason: "mismatch" };
  } catch {
    return { ok: false, reason: "mismatch" };
  }
}

const SIGNATURE_ERRORS = {
  malformed: "That signature can't be read. Sign again, or post without signing.",
  stale: "That signature is more than 10 minutes old (or your clock is off). Sign again.",
  mismatch: "The signature doesn't match this post. Nothing was posted.",
} as const;

/* ---------- posting: everything the server checks before it stores, without the database ---------- */

export type Prepared<T> = { ok: true; post: T; proof: NoteProof | null } | { ok: false; error: string };

export async function prepareThread(
  input: { author: string; text: string; slug: string | null; signed?: SignedInput | null },
  deps: { placeExists: (slug: string) => Promise<boolean>; now: number },
): Promise<Prepared<{ author: string; title: string; body: string; slug: string | null }>> {
  const author = cleanName(String(input.author ?? ""));
  const text = String(input.text ?? "").trim();
  if (!author) return { ok: false, error: "Pick a name first." };
  if (text.length < 8) return { ok: false, error: "Say a bit more." };
  if (text.length > 4000) return { ok: false, error: "That's long. Keep it under 4,000 characters." };
  const slug = input.slug && (await deps.placeExists(input.slug)) ? input.slug : null;
  const { title, body } = splitPost(text);
  const post = { author, title, body, slug };
  if (!input.signed) return { ok: true, post, proof: null };
  // Rebuilt from what we are about to store: if the author signed anything else, it fails.
  const note = threadNote({ author, text, place: slug, createdAt: Number(input.signed.createdAt) });
  const result = await verifyNote(note, input.signed, deps.now);
  return result.ok ? { ok: true, post, proof: result.proof } : { ok: false, error: SIGNATURE_ERRORS[result.reason] };
}

export async function prepareReply(
  input: { threadId: string; parentId: string | null; author: string; body: string; signed?: SignedInput | null },
  deps: { isId: (value: string) => boolean; now: number },
): Promise<Prepared<{ threadId: string; parentId: string | null; author: string; body: string }>> {
  const author = cleanName(String(input.author ?? ""));
  const body = String(input.body ?? "").trim();
  if (!author) return { ok: false, error: "Pick a name first." };
  if (body.length < 2 || body.length > 4000) return { ok: false, error: "Replies are 2 to 4,000 characters." };
  if (!deps.isId(input.threadId) || (input.parentId && !deps.isId(input.parentId))) return { ok: false, error: "That conversation is gone." };
  const post = { threadId: input.threadId, parentId: input.parentId || null, author, body };
  if (!input.signed) return { ok: true, post, proof: null };
  const note = replyNote({ author, text: body, threadId: post.threadId, parentId: post.parentId, createdAt: Number(input.signed.createdAt) });
  const result = await verifyNote(note, input.signed, deps.now);
  return result.ok ? { ok: true, post, proof: result.proof } : { ok: false, error: SIGNATURE_ERRORS[result.reason] };
}

/* ---------- reading: never trust the database, check every stored signature again ---------- */

/** What a card shows. "invalid" means the row claims a signature that does not check out. */
export type SayProof =
  | { status: "valid"; signer: `0x${string}`; signature: string; payload: SignedPayload }
  | { status: "invalid"; signer: string; signature: string; payload: unknown };

/**
 * `shown` is the post as we display it (from the table columns). The stored message must say exactly
 * that, and its signature must recover to the stored signer.
 */
export async function checkStored(
  stored: { signer: string | null; signature: string | null; payload: unknown },
  shown: { kind: Note["kind"]; thread: string; parent: string; title: string; text: string; author: string },
): Promise<SayProof | null> {
  if (!stored.signer && !stored.signature) return null;
  const invalid: SayProof = { status: "invalid", signer: stored.signer ?? "", signature: stored.signature ?? "", payload: stored.payload };
  const raw = (stored.payload as { message?: Record<string, unknown>; domain?: Record<string, unknown> } | null) ?? {};
  const message = raw.message;
  if (!message || raw.domain?.name !== NOTE_DOMAIN.name || raw.domain?.version !== NOTE_DOMAIN.version) return invalid;
  const note: Note = {
    kind: message.kind as Note["kind"],
    place: String(message.place ?? ""),
    thread: String(message.thread ?? ""),
    parent: String(message.parent ?? ""),
    title: String(message.title ?? ""),
    text: String(message.text ?? ""),
    author: String(message.author ?? ""),
    createdAt: Number(message.createdAt),
  };
  const same = (Object.keys(shown) as Array<keyof typeof shown>).every((key) => note[key] === shown[key]);
  if (!same) return invalid;
  const result = await verifyNote(note, { signer: stored.signer ?? "", signature: stored.signature ?? "" });
  return result.ok ? { status: "valid", signer: result.proof.signer, signature: result.proof.signature, payload: result.proof.payload } : invalid;
}
