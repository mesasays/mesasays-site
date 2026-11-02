import { p256 } from "@noble/curves/p256";
import { sha256 } from "viem";

// Passkey signatures for Say notes (WebAuthn, P-256 / ES256). Face ID, Touch ID, a fingerprint or a
// security key signs the note: no wallet, no seed phrase, no account on our side.
//
// What the device signs is fixed by WebAuthn: authenticatorData || sha256(clientDataJSON), where
// clientDataJSON carries our challenge. The challenge is the EIP-712 digest of the note (the very hash a
// wallet would sign), so one note has one hash whatever the signing method. Spec: docs/SAY_FARCASTER.md.
//
// Shared by the browser, the server, the scripts and anyone who wants to check a proof: no "@/" imports,
// no Node-only APIs (Node 22.18+ runs this file as is in scripts/test-say-farcaster.mjs).

export type Hex = `0x${string}`;

/** A passkey assertion as sent by the browser (every field base64url). */
export type PasskeyAssertion = {
  /** Uncompressed P-256 public key (65 bytes, 0x04 || x || y), kept by the browser since the passkey was created. */
  publicKey: string;
  /** The signature as WebAuthn returns it (DER) or as raw r || s (64 bytes). */
  signature: string;
  authenticatorData: string;
  clientDataJSON: string;
};

/** The default origin of signed notes; other origins are spelled out in proofs. */
export const PASSKEY_ORIGIN = "https://mesasays.com";

/* ---------- bytes ---------- */

const utf8 = new TextEncoder();
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

export function toB64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("not base64url");
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export const hexToBytes = (hex: string) => Uint8Array.from((hex.replace(/^0x/, "").match(/../g) ?? []).map((pair) => parseInt(pair, 16)));
export const bytesToHex = (bytes: Uint8Array): Hex => `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};
const sha = (bytes: Uint8Array) => sha256(bytes, "bytes");
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, index) => byte === b[index]);

/** The challenge a passkey signs for a note: its EIP-712 digest, base64url. */
export const passkeyChallenge = (digest: Hex) => toB64url(hexToBytes(digest));

/** Short public id of a passkey: first 8 bytes of sha256(public key), hex. Shown as "passkey 1a2b3c4d". */
export const passkeyId = (publicKey: Uint8Array) => bytesToHex(sha(publicKey)).slice(2, 18);

/** WebAuthn returns ASN.1 DER signatures; P-256 math wants raw r || s. */
export function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length === 64) return der;
  if (der[0] !== 0x30) throw new Error("not a DER signature");
  let offset = 2;
  const int = () => {
    if (der[offset] !== 0x02) throw new Error("not a DER signature");
    const length = der[offset + 1];
    let value = der.slice(offset + 2, offset + 2 + length);
    offset += 2 + length;
    while (value.length > 32 && value[0] === 0) value = value.slice(1);
    if (value.length > 32) throw new Error("bad DER integer");
    const padded = new Uint8Array(32);
    padded.set(value, 32 - value.length);
    return padded;
  };
  return concat(int(), int());
}

/* ---------- verification ---------- */

export type PasskeyResult =
  | { ok: true; publicKey: Uint8Array; id: string; origin: string; signature: Uint8Array }
  | { ok: false; reason: "malformed" | "mismatch" | "origin" };

/**
 * Checks a WebAuthn assertion over a note digest: right challenge, an origin we accept, the rpId hash of that
 * origin's host, user presence, and the P-256 signature. `origins` lists the sites allowed to ask for it.
 */
export function verifyPasskeyAssertion(digest: Hex, assertion: PasskeyAssertion, origins: string[]): PasskeyResult {
  let publicKey: Uint8Array, signature: Uint8Array, authenticatorData: Uint8Array, clientDataBytes: Uint8Array;
  let clientData: { type?: unknown; challenge?: unknown; origin?: unknown };
  try {
    publicKey = fromB64url(assertion.publicKey);
    signature = derToRaw(fromB64url(assertion.signature));
    authenticatorData = fromB64url(assertion.authenticatorData);
    clientDataBytes = fromB64url(assertion.clientDataJSON);
    clientData = JSON.parse(utf8Decoder.decode(clientDataBytes));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (publicKey.length !== 65 || publicKey[0] !== 0x04 || authenticatorData.length < 37) return { ok: false, reason: "malformed" };
  if (clientData.type !== "webauthn.get" || clientData.challenge !== passkeyChallenge(digest)) return { ok: false, reason: "mismatch" };
  const origin = String(clientData.origin ?? "");
  if (!origins.includes(origin)) return { ok: false, reason: "origin" };
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return { ok: false, reason: "origin" };
  }
  // rpIdHash (first 32 bytes) must be sha256 of the site's host; bit 0 of the flags = the user was present.
  if (!equal(authenticatorData.slice(0, 32), sha(utf8.encode(host))) || !(authenticatorData[32] & 0x01)) return { ok: false, reason: "mismatch" };
  const signed = sha(concat(authenticatorData, sha(clientDataBytes)));
  let valid = false;
  try {
    valid = p256.verify(signature, signed, publicKey, { lowS: false, prehash: false });
  } catch {
    valid = false;
  }
  return valid ? { ok: true, publicKey, id: passkeyId(publicKey), origin, signature } : { ok: false, reason: "mismatch" };
}

/* ---------- compact form, for a proof that fits in one Farcaster embed URL ---------- */

// A P-256 public key can be recovered from a signature plus one bit, as with Ethereum: the proof carries
// r || s || bit (65 bytes) instead of the 65-byte key on top of the 64-byte signature. The parts of
// authenticatorData and clientDataJSON that follow from the note and the origin are rebuilt, not stored.

const CHROME_EXTRA = ',"other_keys_can_be_added_here":"do not compare clientDataJSON against a template. See https://goo.gl/yabPex"';

function clientDataTemplate(variant: string, challenge: string, origin: string) {
  const base = `{"type":"webauthn.get","challenge":${JSON.stringify(challenge)},"origin":${JSON.stringify(origin)}`;
  if (variant === "a") return `${base},"crossOrigin":false}`;
  if (variant === "b") return `${base}}`;
  if (variant === "c") return `${base},"crossOrigin":false${CHROME_EXTRA}}`;
  return null;
}

/** "a" | "b" | "c" (+ ".<origin b64url>" if not mesasays.com), or "r.<full clientDataJSON b64url>". */
function compactClientData(clientDataBytes: Uint8Array, challenge: string, origin: string) {
  const raw = utf8Decoder.decode(clientDataBytes);
  for (const variant of ["a", "b", "c"]) {
    if (clientDataTemplate(variant, challenge, origin) === raw) return origin === PASSKEY_ORIGIN ? variant : `${variant}.${toB64url(utf8.encode(origin))}`;
  }
  return `r.${toB64url(clientDataBytes)}`;
}

function expandClientData(code: string, challenge: string): Uint8Array {
  const [variant, extra = ""] = code.split(".");
  if (variant === "r") return fromB64url(extra);
  const origin = extra ? utf8Decoder.decode(fromB64url(extra)) : PASSKEY_ORIGIN;
  const json = clientDataTemplate(variant, challenge, origin);
  if (json === null) throw new Error("unknown clientData variant");
  return utf8.encode(json);
}

const signedHash = (authenticatorData: Uint8Array, clientDataBytes: Uint8Array) => sha(concat(authenticatorData, sha(clientDataBytes)));

/** Which of the two candidate keys is this one (0 or 1). */
export function recoveryBit(signature: Uint8Array, hash: Uint8Array, publicKey: Uint8Array): number {
  for (const bit of [0, 1]) {
    try {
      const key = p256.Signature.fromCompact(signature).addRecoveryBit(bit).recoverPublicKey(hash).toRawBytes(false);
      if (equal(key, publicKey)) return bit;
    } catch {
      // try the other bit
    }
  }
  throw new Error("public key does not match the signature");
}

/** Turns a verified assertion into the compact fields stored in a proof: [signature+bit, authData, clientData]. */
export function compactAssertion(assertion: PasskeyAssertion, digest: Hex): [string, string, string] {
  const publicKey = fromB64url(assertion.publicKey);
  const signature = derToRaw(fromB64url(assertion.signature));
  const authenticatorData = fromB64url(assertion.authenticatorData);
  const clientDataBytes = fromB64url(assertion.clientDataJSON);
  const origin = String(JSON.parse(utf8Decoder.decode(clientDataBytes)).origin ?? "");
  const bit = recoveryBit(signature, signedHash(authenticatorData, clientDataBytes), publicKey);
  const host = new URL(origin).hostname;
  // Standard 37-byte authenticatorData whose rpIdHash follows from the origin: keep flags + counter only.
  const ad = authenticatorData.length === 37 && equal(authenticatorData.slice(0, 32), sha(utf8.encode(host))) ? authenticatorData.slice(32) : authenticatorData;
  return [toB64url(concat(signature, Uint8Array.of(bit))), toB64url(ad), compactClientData(clientDataBytes, passkeyChallenge(digest), origin)];
}

/** Rebuilds the full assertion (public key included) from compact fields and the note digest. */
export function expandAssertion(fields: [string, string, string], digest: Hex): PasskeyAssertion {
  const [sigField, adField, cdField] = fields;
  const sigBytes = fromB64url(sigField);
  if (sigBytes.length !== 65 || sigBytes[64] > 1) throw new Error("bad passkey signature");
  const clientDataBytes = expandClientData(cdField, passkeyChallenge(digest));
  const origin = String(JSON.parse(utf8Decoder.decode(clientDataBytes)).origin ?? "");
  const adBytes = fromB64url(adField);
  const authenticatorData = adBytes.length === 5 ? concat(sha(utf8.encode(new URL(origin).hostname)), adBytes) : adBytes;
  const signature = sigBytes.slice(0, 64);
  const publicKey = p256.Signature.fromCompact(signature)
    .addRecoveryBit(sigBytes[64])
    .recoverPublicKey(signedHash(authenticatorData, clientDataBytes))
    .toRawBytes(false);
  return {
    publicKey: toB64url(publicKey),
    signature: toB64url(signature),
    authenticatorData: toB64url(authenticatorData),
    clientDataJSON: toB64url(clientDataBytes),
  };
}

/**
 * The browser keeps the public key from the moment the passkey is created. If it was lost (another device,
 * cleared storage), two signatures by the same passkey pin it down: each allows two keys, one is shared.
 */
export function recoverPublicKeyFromTwo(
  first: { signature: Uint8Array; authenticatorData: Uint8Array; clientDataJSON: Uint8Array },
  second: { signature: Uint8Array; authenticatorData: Uint8Array; clientDataJSON: Uint8Array },
): Uint8Array | null {
  const candidates = (item: typeof first) =>
    [0, 1].flatMap((bit) => {
      try {
        return [p256.Signature.fromCompact(derToRaw(item.signature)).addRecoveryBit(bit).recoverPublicKey(signedHash(item.authenticatorData, item.clientDataJSON)).toRawBytes(false)];
      } catch {
        return [];
      }
    });
  const a = candidates(first);
  const b = candidates(second);
  const shared = a.filter((key) => b.some((other) => equal(key, other)));
  return shared.length === 1 ? shared[0] : null;
}
