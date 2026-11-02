import { getAddress, hashTypedData, verifyTypedData } from "viem";
import { passkeyId, verifyPasskeyAssertion, type Hex, type PasskeyAssertion } from "./passkey.ts";

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

/** What the browser sends next to the post when it is signed: an Ethereum wallet signature (default) or a passkey. */
export type SignedInput =
  | { method?: "eip712"; signer: string; signature: string; createdAt: number }
  | ({ method: "passkey"; createdAt: number } & PasskeyAssertion);

/** A verified wallet signature, ready to be stored. */
export type Eip712Proof = { method: "eip712"; signer: `0x${string}`; signature: `0x${string}`; payload: SignedPayload };
/** A verified passkey signature. `signer` is the passkey id (sha256 of its public key, 8 bytes hex). */
export type PasskeyProof = { method: "passkey"; signer: string; signature: string; payload: SignedPayload; passkey: PasskeyAssertion & { origin: string } };
export type NoteProof = Eip712Proof | PasskeyProof;

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

/** The EIP-712 hash of a note: what a wallet signs, and the challenge a passkey signs. */
export const noteDigest = (note: Note): Hex =>
  hashTypedData({ domain: NOTE_DOMAIN, types: NOTE_TYPES, primaryType: "Note", message: { ...note, createdAt: BigInt(note.createdAt) } });

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

export type VerifyResult = { ok: true; proof: Eip712Proof } | { ok: false; reason: "malformed" | "stale" | "mismatch" };

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
    return valid ? { ok: true, proof: { method: "eip712", signer, signature, payload: notePayload(note) } } : { ok: false, reason: "mismatch" };
  } catch {
    return { ok: false, reason: "mismatch" };
  }
}

export type SignedResult = { ok: true; proof: NoteProof } | { ok: false; reason: "malformed" | "stale" | "mismatch" | "origin" | "passkey" };

/**
 * Checks either kind of signature. Passkeys are accepted only when `origins` is given (the sites allowed to
 * ask for one); the database backends leave it out, as they have no column for passkey proofs.
 */
export async function verifySigned(note: Note, signed: SignedInput, now?: number, origins?: string[]): Promise<SignedResult> {
  if (signed.method !== "passkey") return verifyNote(note, signed, now);
  if (!origins) return { ok: false, reason: "passkey" };
  if (!Number.isSafeInteger(note.createdAt) || note.createdAt <= 0) return { ok: false, reason: "malformed" };
  if (now !== undefined && Math.abs(now - note.createdAt) > MAX_SKEW_SECONDS) return { ok: false, reason: "stale" };
  const assertion: PasskeyAssertion = {
    publicKey: String(signed.publicKey ?? ""),
    signature: String(signed.signature ?? ""),
    authenticatorData: String(signed.authenticatorData ?? ""),
    clientDataJSON: String(signed.clientDataJSON ?? ""),
  };
  const result = verifyPasskeyAssertion(noteDigest(note), assertion, origins);
  if (!result.ok) return result;
  return {
    ok: true,
    proof: { method: "passkey", signer: passkeyId(result.publicKey), signature: assertion.signature, payload: notePayload(note), passkey: { ...assertion, origin: result.origin } },
  };
}

const SIGNATURE_ERRORS = {
  malformed: "That signature can't be read. Sign again, or post without signing.",
  origin: "That passkey signature was made for another website. Nothing was posted.",
  passkey: "Passkey signing isn't switched on here yet. Sign with a wallet, or post without signing.",
  stale: "That signature is more than 10 minutes old (or your clock is off). Sign again.",
  mismatch: "The signature doesn't match this post. Nothing was posted.",
} as const;

/* ---------- posting: everything the server checks before it stores, without the database ---------- */

export type Prepared<T> = { ok: true; post: T; proof: NoteProof | null } | { ok: false; error: string };

/** `origins`: passkeys allowed (Farcaster backend). `requireSignature`: refuse unsigned posts. */
type PrepareOptions = { now: number; origins?: string[]; requireSignature?: boolean };
const UNSIGNED_REFUSED = "Sign your post first (passkey or wallet): that's how we keep spam out without accounts.";

export async function prepareThread(
  input: { author: string; text: string; slug: string | null; signed?: SignedInput | null },
  deps: PrepareOptions & { placeExists: (slug: string) => Promise<boolean> },
): Promise<Prepared<{ author: string; title: string; body: string; slug: string | null }>> {
  const author = cleanName(String(input.author ?? ""));
  const text = String(input.text ?? "").trim();
  if (!author) return { ok: false, error: "Pick a name first." };
  if (text.length < 8) return { ok: false, error: "Say a bit more." };
  if (text.length > 4000) return { ok: false, error: "That's long. Keep it under 4,000 characters." };
  const slug = input.slug && (await deps.placeExists(input.slug)) ? input.slug : null;
  const { title, body } = splitPost(text);
  const post = { author, title, body, slug };
  if (!input.signed) return deps.requireSignature ? { ok: false, error: UNSIGNED_REFUSED } : { ok: true, post, proof: null };
  // Rebuilt from what we are about to store: if the author signed anything else, it fails.
  const note = threadNote({ author, text, place: slug, createdAt: Number(input.signed.createdAt) });
  const result = await verifySigned(note, input.signed, deps.now, deps.origins);
  return result.ok ? { ok: true, post, proof: result.proof } : { ok: false, error: SIGNATURE_ERRORS[result.reason] };
}

export async function prepareReply(
  input: { threadId: string; parentId: string | null; author: string; body: string; signed?: SignedInput | null },
  deps: PrepareOptions & { isId: (value: string) => boolean },
): Promise<Prepared<{ threadId: string; parentId: string | null; author: string; body: string }>> {
  const author = cleanName(String(input.author ?? ""));
  const body = String(input.body ?? "").trim();
  if (!author) return { ok: false, error: "Pick a name first." };
  if (body.length < 2 || body.length > 4000) return { ok: false, error: "Replies are 2 to 4,000 characters." };
  if (!deps.isId(input.threadId) || (input.parentId && !deps.isId(input.parentId))) return { ok: false, error: "That conversation is gone." };
  const post = { threadId: input.threadId, parentId: input.parentId || null, author, body };
  if (!input.signed) return deps.requireSignature ? { ok: false, error: UNSIGNED_REFUSED } : { ok: true, post, proof: null };
  const note = replyNote({ author, text: body, threadId: post.threadId, parentId: post.parentId, createdAt: Number(input.signed.createdAt) });
  const result = await verifySigned(note, input.signed, deps.now, deps.origins);
  return result.ok ? { ok: true, post, proof: result.proof } : { ok: false, error: SIGNATURE_ERRORS[result.reason] };
}

/* ---------- reading: never trust the database, check every stored signature again ---------- */

/**
 * What a card shows. "invalid" means the post claims a signature that does not check out.
 * `method` is absent on older data (= "eip712"). For a passkey, `signer` is the passkey id.
 */
export type SayProof =
  | { status: "valid"; method?: "eip712" | "passkey"; signer: string; signature: string; payload: SignedPayload; passkey?: PasskeyAssertion & { origin: string } }
  | { status: "invalid"; method?: "eip712" | "passkey"; signer: string; signature: string; payload: unknown };

/** The proof as displayed, from a verified one. */
export const shownProof = (proof: NoteProof): SayProof =>
  proof.method === "passkey"
    ? { status: "valid", method: "passkey", signer: proof.signer, signature: proof.signature, payload: proof.payload, passkey: proof.passkey }
    : { status: "valid", method: "eip712", signer: proof.signer, signature: proof.signature, payload: proof.payload };

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
  return result.ok ? shownProof(result.proof) : invalid;
}
