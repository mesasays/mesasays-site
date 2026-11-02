import { CastType, FarcasterNetwork, Message, MessageData, NobleEd25519Signer, bytesToHexString, makeCastAdd, validations } from "@farcaster/core";
import { byteLength, CAST_BYTES, LONG_CAST_BYTES, MAX_EMBEDS, URL_BYTES } from "../relayed.ts";
import { hexToBytes } from "../passkey.ts";

// Builds and checks Farcaster CastAdd messages with the official library (@farcaster/core, MIT, the same
// code the protocol team ships). Server and scripts only: the library is heavy and must stay out of the
// browser bundle. No "@/" imports, so scripts/test-say-farcaster.mjs runs it in Node.

export type CastInput = {
  fid: number;
  /** Ed25519 app key (32-byte private key, hex). */
  privateKey: string;
  text: string;
  embeds: string[];
  parentUrl?: string | null;
  parentCastId?: { fid: number; hash: string } | null;
  /** Farcaster time (seconds since 2021-01-01); defaults to now. */
  timestamp?: number;
};

export type BuiltCast = { message: Message; hash: string; bytes: Uint8Array; json: unknown; type: "CAST" | "LONG_CAST" };

export function castTypeFor(text: string): "CAST" | "LONG_CAST" {
  const bytes = byteLength(text);
  if (bytes > LONG_CAST_BYTES) throw new Error(`cast text is ${bytes} bytes, more than ${LONG_CAST_BYTES}`);
  return bytes > CAST_BYTES ? "LONG_CAST" : "CAST";
}

export async function buildCast(input: CastInput): Promise<BuiltCast> {
  if (!Number.isSafeInteger(input.fid) || input.fid <= 0) throw new Error("fid must be a positive integer");
  if (input.embeds.length > MAX_EMBEDS) throw new Error(`at most ${MAX_EMBEDS} embeds`);
  for (const url of input.embeds) if (byteLength(url) > URL_BYTES) throw new Error(`embed longer than ${URL_BYTES} bytes`);
  if (Boolean(input.parentUrl) === Boolean(input.parentCastId)) throw new Error("a cast needs exactly one of parentUrl / parentCastId");
  const type = castTypeFor(input.text);
  const signer = new NobleEd25519Signer(hexToBytes(input.privateKey));
  const result = await makeCastAdd(
    {
      text: input.text,
      embeds: input.embeds.map((url) => ({ url })),
      embedsDeprecated: [],
      mentions: [],
      mentionsPositions: [],
      parentUrl: input.parentUrl ?? undefined,
      parentCastId: input.parentCastId ? { fid: input.parentCastId.fid, hash: hexToBytes(input.parentCastId.hash) } : undefined,
      type: type === "LONG_CAST" ? CastType.LONG_CAST : CastType.CAST,
    },
    { fid: input.fid, network: FarcasterNetwork.MAINNET, ...(input.timestamp ? { timestamp: input.timestamp } : {}) },
    signer,
  );
  if (result.isErr()) throw new Error(`cast not built: ${result.error.message}`);
  const message = result.value as unknown as Message;
  // Same checks a hub runs on the message itself: hash, Ed25519 signature, body rules.
  const valid = await validations.validateMessage(message);
  if (valid.isErr()) throw new Error(`cast invalid: ${valid.error.message}`);
  const hash = bytesToHexString(message.hash);
  if (hash.isErr()) throw new Error("hash");
  return { message, hash: hash.value, bytes: Message.encode(message).finish(), json: Message.toJSON(message), type };
}

/** Decodes protobuf bytes and validates them again: what a hub does when it receives the message. */
export async function decodeAndValidate(bytes: Uint8Array) {
  const message = Message.decode(bytes);
  const valid = await validations.validateMessage(message);
  return { message, ok: valid.isOk(), error: valid.isErr() ? valid.error.message : null };
}

/** The app key's public half, hex (what gets registered on chain). */
export async function publicKeyOf(privateKey: string) {
  const signer = new NobleEd25519Signer(hexToBytes(privateKey));
  const key = await signer.getSignerKey();
  if (key.isErr()) throw new Error("bad key");
  return bytesToHexString(key.value)._unsafeUnwrap();
}

/**
 * Re-checks a message as a hub served it (HTTP API JSON): rebuild its exact bytes, recompute the BLAKE3
 * hash, check the Ed25519 signature. A hub that changed a text, a link or an author would be caught here.
 * (Whether the signing key belongs to the fid is checked by hubs against the Optimism key registry; not here.)
 *
 * Trap: the hub writes hashes and keys in hex ("0x…") where the protobuf JSON format expects base64, so
 * Message.fromJSON alone reads them wrong and every genuine message looks forged. Convert them first.
 *
 * Limit: the hub's JSON is a re-encoding; the hash covers the original bytes. For current clients they match
 * (all recent casts tested pass), but some 2023–2024 casts no longer re-encode identically and fail here.
 * Say topics are new, so this only matters if old casts get linked. Such a message is hidden, not shown unchecked.
 */
export async function verifyHubMessage(json: {
  data: unknown;
  hash: string;
  hashScheme?: string;
  signature?: string;
  signatureScheme?: string;
  signer?: string;
}): Promise<boolean> {
  if (!json?.signature || !json.signer || !json.hash) return false;
  if (json.hashScheme !== "HASH_SCHEME_BLAKE3" || json.signatureScheme !== "SIGNATURE_SCHEME_ED25519") return false;
  try {
    const data = structuredClone(json.data) as { castAddBody?: { parentCastId?: { hash?: string } | null; embeds?: Array<{ castId?: { hash?: string } }> } };
    const toBase64 = (hex: string) => btoa(String.fromCharCode(...hexToBytes(hex)));
    const body = data.castAddBody;
    if (body?.parentCastId?.hash?.startsWith("0x")) body.parentCastId.hash = toBase64(body.parentCastId.hash);
    for (const embed of body?.embeds ?? []) if (embed.castId?.hash?.startsWith("0x")) embed.castId.hash = toBase64(embed.castId.hash);
    const message = Message.create({
      data: MessageData.fromJSON(data),
      hash: hexToBytes(json.hash),
      hashScheme: 1, // BLAKE3
      signature: Uint8Array.from(atob(json.signature), (char) => char.charCodeAt(0)),
      signatureScheme: 1, // Ed25519
      signer: hexToBytes(json.signer),
    });
    return (await validations.validateMessage(message)).isOk();
  } catch {
    return false;
  }
}
