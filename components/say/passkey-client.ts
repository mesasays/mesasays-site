"use client";

import { useMemo, useSyncExternalStore } from "react";
import { derToRaw, fromB64url, passkeyChallenge, passkeyId, recoverPublicKeyFromTwo, toB64url } from "@/lib/say/passkey";
import { noteDigest, type Note, type SignedInput } from "@/lib/say/signature";

// Passkeys in the browser (WebAuthn). The passkey itself lives in the person's device or password manager
// (iCloud Keychain, Google Password Manager, 1Password, a security key...). We keep only its public key
// and id in this browser, to know which key signed. Nothing about it is sent anywhere but with a post.

const KEY = "mesasays-say-passkey";

export type PasskeyIdentity = { credentialId: string; publicKey: string };

export const passkeysSupported = () => typeof window !== "undefined" && typeof window.PublicKeyCredential === "function" && Boolean(navigator.credentials);

function readRaw() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): PasskeyIdentity | null {
  try {
    const value = JSON.parse(raw ?? "null") as PasskeyIdentity | null;
    return value?.credentialId && value.publicKey ? value : null;
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(KEY, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(KEY, callback);
    window.removeEventListener("storage", callback);
  };
}

/** The passkey this browser remembers (null on the server and before one is made). */
export function usePasskeyIdentity(): PasskeyIdentity | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parse(raw), [raw]);
}

function remember(identity: PasskeyIdentity) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // Private mode: the key is recovered from two signatures next time.
  }
  window.dispatchEvent(new Event(KEY));
}

export const passkeyLabel = (identity: PasskeyIdentity) => `passkey ${passkeyId(fromB64url(identity.publicKey)).slice(0, 8)}`;

export class PasskeyError extends Error {
  cancelled: boolean;
  constructor(cancelled: boolean, message = cancelled ? "cancelled" : "failed") {
    super(message);
    this.cancelled = cancelled;
  }
}

const buffer = (bytes: Uint8Array) => bytes.slice().buffer as ArrayBuffer;
const random = (length: number) => crypto.getRandomValues(new Uint8Array(length));
const rpId = () => window.location.hostname;

function wrap(error: unknown): never {
  if (error instanceof PasskeyError) throw error;
  // NotAllowedError = the person closed the prompt (or it timed out).
  const name = (error as { name?: string } | null)?.name;
  throw new PasskeyError(name === "NotAllowedError" || name === "AbortError");
}

/** Makes a new passkey for this site (one Face ID / fingerprint prompt) and remembers its public key. */
export async function createPasskey(name: string): Promise<PasskeyIdentity> {
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        rp: { name: "MesaSays", id: rpId() },
        user: { id: buffer(random(16)), name: name || "mesasays", displayName: name || "MesaSays" },
        challenge: buffer(random(32)),
        pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256 = P-256
        authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
        attestation: "none",
        timeout: 120_000,
      },
    })) as PublicKeyCredential | null;
    if (!credential) throw new PasskeyError(true);
    const response = credential.response as AuthenticatorAttestationResponse;
    if (response.getPublicKeyAlgorithm?.() !== -7) throw new PasskeyError(false, "This passkey uses another algorithm. Try another device or a wallet.");
    const spki = response.getPublicKey?.();
    if (!spki) throw new PasskeyError(false, "This browser can't share the passkey's public key. Try a wallet.");
    // A P-256 SubjectPublicKeyInfo ends with the 65-byte uncompressed point.
    const identity = { credentialId: toB64url(new Uint8Array(credential.rawId)), publicKey: toB64url(new Uint8Array(spki).slice(-65)) };
    remember(identity);
    return identity;
  } catch (error) {
    wrap(error);
  }
}

async function assert(challenge: Uint8Array, credentialId?: string) {
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: buffer(challenge),
      rpId: rpId(),
      allowCredentials: credentialId ? [{ type: "public-key", id: buffer(fromB64url(credentialId)) }] : [],
      userVerification: "preferred",
      timeout: 120_000,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new PasskeyError(true);
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    credentialId: toB64url(new Uint8Array(credential.rawId)),
    signature: new Uint8Array(response.signature),
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: new Uint8Array(response.clientDataJSON),
  };
}

/**
 * "I already have a passkey": the device picks one, signs twice (two prompts), and the public key is
 * recovered from the two signatures (each allows two keys, one is common to both).
 */
export async function findPasskey(): Promise<PasskeyIdentity> {
  return findPasskeyFinish(await findPasskeyStart());
}

// Safari allows one passkey prompt per tap: the two signatures above are split over two taps on the page.
export type PasskeyFirstStep = Awaited<ReturnType<typeof assert>>;

/** "I already have one", tap 1: the device picks a passkey and signs once. */
export async function findPasskeyStart(): Promise<PasskeyFirstStep> {
  try {
    return await assert(random(32));
  } catch (error) {
    wrap(error);
  }
}

/** Tap 2: the same passkey signs again; its public key is recovered from the two signatures. */
export async function findPasskeyFinish(first: PasskeyFirstStep): Promise<PasskeyIdentity> {
  try {
    const second = await assert(random(32), first.credentialId);
    const key = recoverPublicKeyFromTwo(first, second);
    if (!key) throw new PasskeyError(false, "Couldn't recognise that passkey. Create a new one.");
    const identity = { credentialId: first.credentialId, publicKey: toB64url(key) };
    remember(identity);
    return identity;
  } catch (error) {
    wrap(error);
  }
}

/** Signs a note with the passkey: the challenge is the note's EIP-712 hash. */
export async function signNoteWithPasskey(note: Note, identity: PasskeyIdentity): Promise<SignedInput> {
  try {
    const result = await assert(fromB64url(passkeyChallenge(noteDigest(note))), identity.credentialId);
    return {
      method: "passkey",
      createdAt: note.createdAt,
      publicKey: identity.publicKey,
      signature: toB64url(derToRaw(result.signature)),
      authenticatorData: toB64url(result.authenticatorData),
      clientDataJSON: toB64url(result.clientDataJSON),
    };
  } catch (error) {
    wrap(error);
  }
}
