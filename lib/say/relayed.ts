import { recoverTypedDataAddress } from "viem";
import { compactAssertion, expandAssertion, fromB64url, hexToBytes, bytesToHex, passkeyId, toB64url, verifyPasskeyAssertion } from "./passkey.ts";
import { NOTE_DOMAIN, NOTE_TYPES, noteDigest, notePayload, shortAddress, type Note, type NoteProof, type SayProof } from "./signature.ts";

// Say on Farcaster: topics, the text of a relayed cast, and the proof that rides along with it.
//
// - A restaurant's conversations are casts whose parentUrl is https://mesasays.com/restaurants/<slug>
//   (English and Spanish pages share it); general ones use https://mesasays.com/say.
// - A note written on mesasays.com is published by the MesaSays account as ONE cast: the text as people
//   wrote it, a footer that says who and how, and an embed URL that carries the author's signature.
//   Every hub keeps that cast, so anyone can check the signature later without us.
//
// Spec: docs/SAY_FARCASTER.md. Shared by the browser, the server and scripts: no "@/" imports, no Farcaster
// library (casts are read as the JSON the hub HTTP API returns).

export const SITE = "https://mesasays.com";
export const SAY_TOPIC = `${SITE}/say`;
export const PROOF_PREFIX = `${SITE}/proof#`;

/** Farcaster limits (snapchain src/core/validations): text bytes per cast type, URL bytes, embeds without Pro. */
export const CAST_BYTES = 320;
export const LONG_CAST_BYTES = 1024;
export const URL_BYTES = 256;
export const MAX_EMBEDS = 2;

const utf8 = new TextEncoder();
const utf8Decoder = new TextDecoder();
export const byteLength = (text: string) => utf8.encode(text).length;

export const topicUrl = (slug: string | null | undefined) => (slug ? `${SITE}/restaurants/${slug}` : SAY_TOPIC);
export function slugFromTopic(url: string | null | undefined) {
  const match = /^https:\/\/mesasays\.com\/restaurants\/([a-z0-9-]{1,80})$/.exec(url ?? "");
  return match ? match[1] : null;
}
export const isSayTopic = (url: string | null | undefined) => url === SAY_TOPIC || slugFromTopic(url) !== null;

/** Our id for a cast, used in URLs (/say/<fid>-<hash>) and in signed notes (thread / parent). */
export const castKey = (fid: number, hash: string) => `${fid}-${hash.toLowerCase()}`;
const CAST_KEY = /^([1-9]\d{0,11})-(0x[0-9a-f]{40})$/;
export const isCastKey = (value: string) => CAST_KEY.test(value);
export function parseCastKey(value: string) {
  const match = CAST_KEY.exec(value);
  return match ? { fid: Number(match[1]), hash: match[2] } : null;
}

/* ---------- the visible text ---------- */

/** What a reader sees: for a new conversation the headline, a line break, the details; for a reply its text. */
export const noteContent = (note: Pick<Note, "kind" | "title" | "text">) =>
  note.kind === "thread" ? (note.text ? `${note.title}\n${note.text}` : note.title) : note.text;

export const signedLabel = (proof: Pick<NoteProof, "method" | "signer"> | null) =>
  !proof ? "not signed" : proof.method === "passkey" ? `passkey ${proof.signer.slice(0, 8)}` : `signed ${shortAddress(proof.signer)}`;

const FOOTER = "\n\n— ";
export const relayFooter = (author: string, label: string) => `${FOOTER}${author} · via mesasays.com · ${label}`;
export const migratedFooter = (author: string, date: string, signer: string | null) =>
  `${FOOTER}${author} · migrated from mesasays.com · ${date}${signer ? ` · signed ${shortAddress(signer)}` : ""}`;

/* ---------- the proof, packed into embed URLs ---------- */

// Fields joined by "~" (not in base64url, not in names):
//   1 ~ e ~ author ~ createdAt ~ titleBytes ~ root ~ signer ~ signature                              (wallet, EIP-712)
//   1 ~ p ~ author ~ createdAt ~ titleBytes ~ root ~ signer ~ signature+bit ~ authData ~ clientData   (passkey)
// author: base64url UTF-8. createdAt: base 36. titleBytes: UTF-8 length of the headline (threads; "" for
// replies). root: for a reply to a reply, the conversation's cast "<fid>.<hash base64url>", else "".
// signer: the 20-byte address, or the 8-byte passkey id, base64url. Everything else (kind, place, thread,
// parent, title, text) is read from the cast itself. The signature is checked by recovering its key
// (ecrecover for wallets, P-256 key recovery for passkeys), which must give exactly that signer: a note
// changed after signing recovers to some other key and fails.
// If the proof is longer than one URL allows, it continues in a second embed starting with "+".

export type RelayProofInput = { note: Note; proof: NoteProof };

function encodeRoot(note: Note) {
  if (note.kind !== "reply" || !note.parent) return "";
  const root = parseCastKey(note.thread);
  if (!root) throw new Error("reply thread is not a cast id");
  return `${root.fid}.${toB64url(hexToBytes(root.hash))}`;
}

export function encodeProof({ note, proof }: RelayProofInput): string {
  const head = ["1", proof.method === "passkey" ? "p" : "e", toB64url(utf8.encode(note.author)), note.createdAt.toString(36), note.kind === "thread" ? String(byteLength(note.title)) : "", encodeRoot(note), toB64url(hexToBytes(proof.signer))];
  const tail = proof.method === "passkey" ? compactAssertion(proof.passkey, noteDigest(note)) : [toB64url(hexToBytes(proof.signature))];
  return [...head, ...tail].join("~");
}

/** Embed URLs for a proof: one if it fits in 256 bytes, else two. */
export function proofEmbeds(encoded: string): string[] {
  const room = URL_BYTES - PROOF_PREFIX.length;
  if (encoded.length <= room) return [`${PROOF_PREFIX}${encoded}`];
  const rest = encoded.slice(room);
  if (rest.length > room - 1) throw new Error("proof too long for two embeds");
  return [`${PROOF_PREFIX}${encoded.slice(0, room)}`, `${PROOF_PREFIX}+${rest}`];
}

export function proofFromEmbeds(urls: string[]): string | null {
  const parts = urls.filter((url) => url.startsWith(PROOF_PREFIX)).map((url) => url.slice(PROOF_PREFIX.length));
  const first = parts.find((part) => !part.startsWith("+"));
  if (!first) return null;
  return first + parts.filter((part) => part.startsWith("+")).map((part) => part.slice(1)).join("");
}

/** The cast a relayed note becomes (before signing it as a Farcaster message). */
export function relayedCast(input: { note: Note; proof: NoteProof | null }) {
  const text = noteContent(input.note) + relayFooter(input.note.author, signedLabel(input.proof));
  const embeds = input.proof ? proofEmbeds(encodeProof({ note: input.note, proof: input.proof })) : [];
  return { text, embeds, bytes: byteLength(text) };
}

/* ---------- reading a cast back ---------- */

/** The cast fields we need, as the hub HTTP API returns them. */
export type CastView = {
  fid: number;
  hash: string;
  text: string;
  embeds: string[];
  parentUrl: string | null;
  parentCastId: { fid: number; hash: string } | null;
};

export type ReadNote =
  | { kind: "relayed"; author: string; title: string; text: string; note: Note | null; proof: SayProof | null }
  | { kind: "migrated"; author: string; title: string; text: string; date: string; signer: string | null; archive: string | null };

const RELAY_FOOTER = /^(\S+) · via mesasays\.com · (.+)$/u;
const MIGRATED_FOOTER = /^(.+?) · migrated from mesasays\.com · (\d{4}-\d{2}-\d{2})(?: · signed (0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}))?$/u;

function splitTitle(content: string, titleBytes: number | null) {
  if (titleBytes === null) {
    const cut = content.indexOf("\n");
    return cut < 0 ? { title: content, text: "" } : { title: content.slice(0, cut), text: content.slice(cut + 1) };
  }
  const bytes = utf8.encode(content);
  const title = utf8Decoder.decode(bytes.slice(0, titleBytes));
  const text = bytes.length > titleBytes ? utf8Decoder.decode(bytes.slice(titleBytes + 1)) : "";
  return { title, text };
}

/**
 * Reads a cast by the MesaSays account: relayed (with or without a proof), migrated, or null if it is
 * neither (a cast the team wrote directly). `origins` are the sites a passkey proof may come from.
 */
export async function readRelayed(cast: CastView, origins: string[]): Promise<ReadNote | null> {
  const cut = cast.text.lastIndexOf(FOOTER);
  if (cut < 0) return null;
  const content = cast.text.slice(0, cut);
  const footer = cast.text.slice(cut + FOOTER.length);
  const migrated = MIGRATED_FOOTER.exec(footer);
  if (migrated) {
    const { title, text } = cast.parentUrl ? splitTitle(content, null) : { title: "", text: content };
    const archive = cast.embeds.find((url) => url.startsWith("ipfs://")) ?? null;
    return { kind: "migrated", author: migrated[1], title, text, date: migrated[2], signer: migrated[3] ?? null, archive };
  }
  const relayed = RELAY_FOOTER.exec(footer);
  if (!relayed) return null;
  const [, author, label] = relayed;
  const encoded = proofFromEmbeds(cast.embeds);
  if (!encoded) {
    const { title, text } = cast.parentUrl ? splitTitle(content, null) : { title: "", text: content };
    return { kind: "relayed", author, title, text, note: null, proof: null };
  }
  const fields = encoded.split("~");
  const invalidFallback = (): ReadNote => {
    const { title, text } = cast.parentUrl ? splitTitle(content, null) : { title: "", text: content };
    return { kind: "relayed", author, title, text, note: null, proof: { status: "invalid", signer: "", signature: encoded, payload: null } };
  };
  try {
    const [version, method, authorField, createdField, titleField, rootField, signerField, ...rest] = fields;
    if (version !== "1" || (method !== "e" && method !== "p")) return invalidFallback();
    const thread = Boolean(cast.parentUrl);
    const { title, text } = thread ? splitTitle(content, Number(titleField)) : { title: "", text: content };
    let threadId = "";
    let parent = "";
    if (!thread && cast.parentCastId) {
      const parentKey = castKey(cast.parentCastId.fid, cast.parentCastId.hash);
      if (rootField) {
        const [fid, hash] = rootField.split(".");
        threadId = castKey(Number(fid), bytesToHex(fromB64url(hash)));
        parent = parentKey;
      } else {
        threadId = parentKey;
      }
    }
    const note: Note = {
      kind: thread ? "thread" : "reply",
      place: thread ? (slugFromTopic(cast.parentUrl) ?? "") : "",
      thread: threadId,
      parent,
      title,
      text,
      author: utf8Decoder.decode(fromB64url(authorField)),
      createdAt: parseInt(createdField, 36),
    };
    if (note.author !== author || !Number.isSafeInteger(note.createdAt)) return invalidFallback();
    const digest = noteDigest(note);
    let proof: NoteProof;
    if (method === "e") {
      const signature = bytesToHex(fromB64url(rest[0]));
      const signer = await recoverTypedDataAddress({
        domain: NOTE_DOMAIN,
        types: NOTE_TYPES,
        primaryType: "Note",
        message: { ...note, createdAt: BigInt(note.createdAt) },
        signature,
      });
      proof = { method: "eip712", signer, signature, payload: notePayload(note) };
    } else {
      const assertion = expandAssertion([rest[0], rest[1], rest[2]], digest);
      const checked = verifyPasskeyAssertion(digest, assertion, origins);
      if (!checked.ok) return { kind: "relayed", author, title, text, note, proof: { status: "invalid", method: "passkey", signer: "", signature: assertion.signature, payload: notePayload(note) } };
      proof = { method: "passkey", signer: passkeyId(checked.publicKey), signature: assertion.signature, payload: notePayload(note), passkey: { ...assertion, origin: checked.origin } };
    }
    // Any signature recovers to SOME key: it proves something only if it is the signer the proof names,
    // and the footer shows that same signer.
    const claimed = bytesToHex(fromB64url(signerField)).toLowerCase();
    const recovered = (proof.method === "passkey" ? `0x${proof.signer}` : proof.signer).toLowerCase();
    if (claimed !== recovered || signedLabel(proof) !== label) return { kind: "relayed", author, title, text, note, proof: { status: "invalid", method: proof.method, signer: proof.signer, signature: proof.signature, payload: proof.payload } };
    const shown: SayProof =
      proof.method === "passkey"
        ? { status: "valid", method: "passkey", signer: proof.signer, signature: proof.signature, payload: proof.payload, passkey: proof.passkey }
        : { status: "valid", method: "eip712", signer: proof.signer, signature: proof.signature, payload: proof.payload };
    return { kind: "relayed", author, title, text, note, proof: shown };
  } catch {
    return invalidFallback();
  }
}
