// Tests Say on Farcaster without a browser, a wallet extension, a Farcaster account or a database.
//
//   node scripts/test-say-farcaster.mjs            (includes read-only calls to public Farcaster hubs)
//   SKIP_LIVE=1 node scripts/test-say-farcaster.mjs   (offline)
//
// Every key is a throwaway made on each run (P-256 with WebCrypto, Ed25519, Ethereum) and never saved.
// Nothing is ever sent to a hub: messages are built and validated locally with @farcaster/core.
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sha256 } from "viem";
import {
  compactAssertion, derToRaw, expandAssertion, fromB64url, passkeyChallenge, passkeyId, recoverPublicKeyFromTwo, toB64url, verifyPasskeyAssertion,
} from "../lib/say/passkey.ts";
import { noteDigest, notePayload, prepareReply, prepareThread, replyNote, threadNote, verifySigned } from "../lib/say/signature.ts";
import {
  PROOF_PREFIX, SAY_TOPIC, castKey, encodeProof, parseCastKey, proofEmbeds, readRelayed, relayedCast, slugFromTopic, topicUrl, URL_BYTES,
} from "../lib/say/relayed.ts";
import { buildCast, decodeAndValidate, publicKeyOf, verifyHubMessage } from "../lib/say/farcaster/message.ts";
import { createLimiter, relayRules } from "../lib/say/farcaster/limits.ts";
import { castById, castsByTopic, castText, profile, repliesTo } from "../lib/say/farcaster/hub.ts";
import { getFarcasterThread, isOurs, linkedSlugs } from "../lib/say/farcaster/read.ts";

const subtle = webcrypto.subtle;
const utf8 = new TextEncoder();
const now = Math.floor(Date.now() / 1000);
const ORIGIN = "https://mesasays.com";
const ORIGINS = [ORIGIN];
const MESASAYS_FID = 1234567;
const placeExists = async (slug) => slug === "galea";

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok  ${name}`);
}

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

/** raw r || s → DER, as a browser's WebAuthn returns it. */
function rawToDer(raw) {
  const int = (bytes) => {
    let value = bytes;
    while (value.length > 1 && value[0] === 0 && !(value[1] & 0x80)) value = value.slice(1);
    if (value[0] & 0x80) value = concat(Uint8Array.of(0), value);
    return concat(Uint8Array.of(0x02, value.length), value);
  };
  const body = concat(int(raw.slice(0, 32)), int(raw.slice(32)));
  return concat(Uint8Array.of(0x30, body.length), body);
}

/** A passkey, simulated: a P-256 key made with WebCrypto, signing exactly what an authenticator signs. */
async function makePasskey(host = "mesasays.com") {
  const keys = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicKey = new Uint8Array(await subtle.exportKey("raw", keys.publicKey));
  return {
    publicKey,
    keys,
    async sign(challenge, { origin = ORIGIN, variant = "a", flags = 0x05, rpHost = host, der = true } = {}) {
      const base = { type: "webauthn.get", challenge, origin };
      const json =
        variant === "a" ? JSON.stringify({ ...base, crossOrigin: false })
        : variant === "c" ? `${JSON.stringify({ ...base, crossOrigin: false }).slice(0, -1)},"other_keys_can_be_added_here":"do not compare clientDataJSON against a template. See https://goo.gl/yabPex"}`
        : JSON.stringify({ origin, type: "webauthn.get", challenge, crossOrigin: false }); // unusual key order
      const clientDataJSON = utf8.encode(json);
      const authenticatorData = concat(sha256(utf8.encode(rpHost), "bytes"), Uint8Array.of(flags, 0, 0, 0, 7));
      const signed = concat(authenticatorData, sha256(clientDataJSON, "bytes"));
      const raw = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, signed));
      return {
        publicKey: toB64url(publicKey),
        signature: toB64url(der ? rawToDer(raw) : raw),
        authenticatorData: toB64url(authenticatorData),
        clientDataJSON: toB64url(clientDataJSON),
      };
    },
  };
}

const text = "Galea: order the cacio e pepe.\nSkip the tiramisu, it was dry on a Tuesday night.";

/* ---------------- passkeys ---------------- */

const passkey = await makePasskey();
const thread = threadNote({ author: "taco_hunter", text, place: "galea", createdAt: now });
const threadAssertion = await passkey.sign(passkeyChallenge(noteDigest(thread)));

await test("passkey: challenge is the note's EIP-712 hash (the same hash a wallet signs)", async () => {
  const wallet = privateKeyToAccount(generatePrivateKey());
  const { domain, types, message } = notePayload(thread);
  const { hashTypedData } = await import("viem");
  assert.equal(noteDigest(thread), hashTypedData({ domain, types: { Note: types.Note }, primaryType: "Note", message: { ...message, createdAt: BigInt(message.createdAt) } }));
  assert.equal(fromB64url(passkeyChallenge(noteDigest(thread))).length, 32);
  void wallet;
});

await test("passkey: a WebCrypto P-256 assertion verifies, and WebCrypto agrees", async () => {
  const result = verifyPasskeyAssertion(noteDigest(thread), threadAssertion, ORIGINS);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.id, passkeyId(passkey.publicKey));
  // Independent check with WebCrypto itself.
  const signed = concat(fromB64url(threadAssertion.authenticatorData), sha256(fromB64url(threadAssertion.clientDataJSON), "bytes"));
  assert.equal(await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, passkey.keys.publicKey, derToRaw(fromB64url(threadAssertion.signature)), signed), true);
});

await test("passkey: raw r||s signatures are accepted too", async () => {
  const raw = await passkey.sign(passkeyChallenge(noteDigest(thread)), { der: false });
  assert.equal(verifyPasskeyAssertion(noteDigest(thread), raw, ORIGINS).ok, true);
});

await test("passkey: tampered text, author or date is refused", async () => {
  for (const changed of [{ ...thread, text: thread.text.replace("dry", "great") }, { ...thread, author: "someone_else" }, { ...thread, createdAt: now + 1 }]) {
    assert.deepEqual(verifyPasskeyAssertion(noteDigest(changed), threadAssertion, ORIGINS), { ok: false, reason: "mismatch" });
  }
});

await test("passkey: tampered signature, authenticatorData or clientDataJSON is refused", async () => {
  const sig = derToRaw(fromB64url(threadAssertion.signature));
  sig[10] ^= 1;
  assert.equal(verifyPasskeyAssertion(noteDigest(thread), { ...threadAssertion, signature: toB64url(sig) }, ORIGINS).ok, false);
  const ad = fromB64url(threadAssertion.authenticatorData);
  ad[36] ^= 1; // counter
  assert.equal(verifyPasskeyAssertion(noteDigest(thread), { ...threadAssertion, authenticatorData: toB64url(ad) }, ORIGINS).ok, false);
  const other = await makePasskey();
  assert.equal(verifyPasskeyAssertion(noteDigest(thread), { ...threadAssertion, publicKey: toB64url(other.publicKey) }, ORIGINS).ok, false);
});

await test("passkey: another site, another rpId, or no user presence is refused", async () => {
  const challenge = passkeyChallenge(noteDigest(thread));
  assert.equal(verifyPasskeyAssertion(noteDigest(thread), await passkey.sign(challenge, { origin: "https://evil.example" }), ORIGINS).reason, "origin");
  assert.equal(verifyPasskeyAssertion(noteDigest(thread), await passkey.sign(challenge, { rpHost: "evil.example" }), ORIGINS).reason, "mismatch");
  assert.equal(verifyPasskeyAssertion(noteDigest(thread), await passkey.sign(challenge, { flags: 0x04 }), ORIGINS).reason, "mismatch");
});

await test("passkey: server-side prepareThread accepts it only where passkeys are on (Farcaster)", async () => {
  const signed = { method: "passkey", createdAt: now, ...threadAssertion };
  const ok = await prepareThread({ author: "taco_hunter", text, slug: "galea", signed }, { now, placeExists, origins: ORIGINS, requireSignature: true });
  assert.equal(ok.ok, true, ok.error);
  assert.equal(ok.proof.method, "passkey");
  assert.equal(ok.proof.signer, passkeyId(passkey.publicKey));
  const off = await prepareThread({ author: "taco_hunter", text, slug: "galea", signed }, { now, placeExists });
  assert.equal(off.ok, false);
  const unsigned = await prepareThread({ author: "taco_hunter", text, slug: "galea" }, { now, placeExists, origins: ORIGINS, requireSignature: true });
  assert.equal(unsigned.ok, false);
  const stale = await verifySigned({ ...thread }, signed, now + 3600, ORIGINS);
  assert.equal(stale.reason, "stale");
});

await test("passkey: compact proof form round-trips (key recovered from signature + 1 bit)", async () => {
  for (const variant of ["a", "c", "raw-order"]) {
    const assertion = await passkey.sign(passkeyChallenge(noteDigest(thread)), { variant });
    const fields = compactAssertion(assertion, noteDigest(thread));
    if (variant !== "raw-order") assert.equal(fields[2], variant);
    else assert.match(fields[2], /^r\./);
    const back = expandAssertion(fields, noteDigest(thread));
    assert.equal(back.publicKey, toB64url(passkey.publicKey));
    assert.equal(verifyPasskeyAssertion(noteDigest(thread), back, ORIGINS).ok, true);
  }
  // Another origin is spelled out in the proof (dev server).
  const dev = await makePasskey("localhost");
  const devAssertion = await dev.sign(passkeyChallenge(noteDigest(thread)), { origin: "http://localhost:3206", rpHost: "localhost" });
  const fields = compactAssertion(devAssertion, noteDigest(thread));
  assert.match(fields[2], /^a\./);
  assert.equal(verifyPasskeyAssertion(noteDigest(thread), expandAssertion(fields, noteDigest(thread)), ["http://localhost:3206"]).ok, true);
});

await test("passkey: a lost public key is recovered from two signatures", async () => {
  const a = await passkey.sign(toB64url(webcrypto.getRandomValues(new Uint8Array(32))));
  const b = await passkey.sign(toB64url(webcrypto.getRandomValues(new Uint8Array(32))));
  const bytes = (x) => ({ signature: fromB64url(x.signature), authenticatorData: fromB64url(x.authenticatorData), clientDataJSON: fromB64url(x.clientDataJSON) });
  assert.equal(toB64url(recoverPublicKeyFromTwo(bytes(a), bytes(b))), toB64url(passkey.publicKey));
});

/* ---------------- relayed casts ---------------- */

const appKey = Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString("hex");
const wallet = privateKeyToAccount(generatePrivateKey());
async function walletProof(note) {
  const { types, domain, primaryType, message } = notePayload(note);
  const signature = await wallet.signTypedData({ domain, types: { Note: types.Note }, primaryType, message: { ...message, createdAt: BigInt(message.createdAt) } });
  const result = await verifySigned(note, { signer: wallet.address, signature, createdAt: note.createdAt }, now);
  assert.equal(result.ok, true);
  return result.proof;
}
async function passkeyProof(note) {
  const assertion = await passkey.sign(passkeyChallenge(noteDigest(note)));
  const result = await verifySigned(note, { method: "passkey", createdAt: note.createdAt, ...assertion }, now, ORIGINS);
  assert.equal(result.ok, true, result.reason);
  return result.proof;
}
/** What a hub would hand back for the cast we built (the fields readRelayed looks at). */
const view = (built, cast, parent) => ({ fid: MESASAYS_FID, hash: built.hash, text: cast.text, embeds: cast.embeds, parentUrl: parent.parentUrl ?? null, parentCastId: parent.parentCastId ?? null });

let rootKey;

await test("relay: a passkey-signed thread becomes a valid CastAdd under the restaurant topic", async () => {
  const proof = await passkeyProof(thread);
  const cast = relayedCast({ note: thread, proof });
  assert.equal(cast.embeds.length, 1, "proof fits in one embed URL");
  assert.ok(cast.embeds[0].startsWith(PROOF_PREFIX) && cast.embeds[0].length <= URL_BYTES);
  assert.match(cast.text, /\n\n— taco_hunter · via mesasays\.com · passkey [0-9a-f]{8}$/);
  const parent = { parentUrl: topicUrl("galea") };
  const built = await buildCast({ fid: MESASAYS_FID, privateKey: appKey, text: cast.text, embeds: cast.embeds, ...parent });
  assert.equal(built.type, "CAST");
  assert.match(built.hash, /^0x[0-9a-f]{40}$/);
  // What a hub does on receipt: decode the bytes and validate hash, Ed25519 signature and body.
  const decoded = await decodeAndValidate(built.bytes);
  assert.equal(decoded.ok, true, decoded.error);
  assert.equal(decoded.message.data.castAddBody.parentUrl, "https://mesasays.com/restaurants/galea");
  assert.equal(decoded.message.data.fid, MESASAYS_FID);
  assert.equal(Buffer.from(decoded.message.signer).toString("hex"), (await publicKeyOf(appKey)).slice(2));
  // Anyone reading the cast back gets the note and a valid proof, without us.
  const read = await readRelayed(view(built, cast, parent), ORIGINS);
  assert.equal(read.kind, "relayed");
  assert.equal(read.proof.status, "valid");
  assert.equal(read.proof.method, "passkey");
  assert.equal(read.proof.signer, passkeyId(passkey.publicKey));
  assert.deepEqual(read.note, thread);
  rootKey = castKey(MESASAYS_FID, built.hash);
});

await test("relay: a wallet-signed reply to a reply carries the conversation root and verifies", async () => {
  const parentKey = castKey(999, "0x" + "ab".repeat(20));
  const reply = replyNote({ author: "chloé", text: "Agreed — get the bread. Ñ ü 🍝", threadId: rootKey, parentId: parentKey, createdAt: now });
  const prepared = await prepareReply({ threadId: rootKey, parentId: parentKey, author: "chloé", body: reply.text, signed: { signer: wallet.address, signature: (await walletProof(reply)).signature, createdAt: now } }, { now, isId: (v) => Boolean(parseCastKey(v)), origins: ORIGINS, requireSignature: true });
  assert.equal(prepared.ok, true, prepared.error);
  const cast = relayedCast({ note: reply, proof: prepared.proof });
  const parent = { parentCastId: parseCastKey(parentKey) };
  const built = await buildCast({ fid: MESASAYS_FID, privateKey: appKey, text: cast.text, embeds: cast.embeds, ...parent });
  assert.equal((await decodeAndValidate(built.bytes)).ok, true);
  const read = await readRelayed(view(built, cast, parent), ORIGINS);
  assert.equal(read.proof.status, "valid");
  assert.equal(read.proof.signer, wallet.address);
  assert.deepEqual(read.note, reply);
});

await test("relay: text changed after signing, or a footer naming someone else, shows 'invalid'", async () => {
  const proof = await walletProof(thread);
  const cast = relayedCast({ note: thread, proof });
  const parent = { parentUrl: topicUrl("galea") };
  const base = { fid: MESASAYS_FID, hash: "0x" + "00".repeat(20), embeds: cast.embeds, ...{ parentUrl: parent.parentUrl, parentCastId: null } };
  assert.equal((await readRelayed({ ...base, text: cast.text.replace("dry", "great") }, ORIGINS)).proof.status, "invalid");
  const otherFooter = await readRelayed({ ...base, text: cast.text.replace(/signed 0x\S+$/, "signed 0xdead…beef") }, ORIGINS);
  assert.equal(otherFooter.proof.status, "invalid");
  // Moved to another restaurant's topic: the signed place no longer matches.
  assert.equal((await readRelayed({ ...base, text: cast.text, parentUrl: topicUrl("pujol") }, ORIGINS)).proof.status, "invalid");
});

await test("relay: long posts become LONG_CAST up to 1,024 bytes; longer is refused; embeds stay ≤ 256 bytes", async () => {
  const long = threadNote({ author: "taco_hunter", text: `Long one.\n${"Order the mole, then the tamales. ".repeat(20)}`, place: "galea", createdAt: now });
  const cast = relayedCast({ note: long, proof: await passkeyProof(long) });
  assert.ok(cast.bytes > 320 && cast.bytes <= 1024);
  const built = await buildCast({ fid: MESASAYS_FID, privateKey: appKey, text: cast.text, embeds: cast.embeds, parentUrl: topicUrl("galea") });
  assert.equal(built.type, "LONG_CAST");
  assert.equal((await decodeAndValidate(built.bytes)).ok, true);
  await assert.rejects(buildCast({ fid: MESASAYS_FID, privateKey: appKey, text: "x".repeat(1025), embeds: [], parentUrl: SAY_TOPIC }));
  // A proof longer than one URL spills into a second embed, and reads back the same.
  const spilled = proofEmbeds("x".repeat(300));
  assert.equal(spilled.length, 2);
  assert.ok(spilled.every((url) => url.length <= URL_BYTES));
});

await test("relay: a tampered message is rejected by the Farcaster library", async () => {
  const cast = relayedCast({ note: thread, proof: await passkeyProof(thread) });
  const built = await buildCast({ fid: MESASAYS_FID, privateKey: appKey, text: cast.text, embeds: cast.embeds, parentUrl: topicUrl("galea") });
  const bytes = built.bytes.slice();
  // The text is in the message twice (data, and the dataBytes that were hashed and signed): change both.
  let at = -1;
  while ((at = Buffer.from(bytes).indexOf(Buffer.from("Galea"), at + 1)) >= 0) bytes[at] = "X".charCodeAt(0);
  assert.equal((await decodeAndValidate(bytes)).ok, false);
});

await test("relay: proof format is documented and compact", async () => {
  const encoded = encodeProof({ note: thread, proof: await walletProof(thread) });
  const fields = encoded.split("~");
  assert.equal(fields[0], "1");
  assert.equal(fields[1], "e");
  assert.equal(new TextDecoder().decode(fromB64url(fields[2])), "taco_hunter");
  assert.equal(parseInt(fields[3], 36), now);
  assert.equal(Number(fields[4]), utf8.encode(thread.title).length);
  assert.equal(fields.length, 8);
  assert.equal(slugFromTopic(topicUrl("galea")), "galea");
  assert.equal(slugFromTopic(SAY_TOPIC), null);
});

/* ---------------- anti-spam ---------------- */

await test("limits: per signer, per IP (below the global one), global, daily, one use per signed note", async () => {
  const t0 = 1_800_000_000_000;
  const rules = (signer, ip, maxPerHour = 30) => relayRules({ signer, ip, maxPerHour });
  // One signer from different networks: 5 per 10 minutes.
  const bySigner = createLimiter();
  for (let i = 0; i < 5; i += 1) assert.equal(bySigner.take(rules("0xabc", `ip${i}`), t0 + i), null);
  assert.equal(bySigner.take(rules("0xabc", "ip9"), t0 + 10).key, "signer:0xabc");
  assert.equal(bySigner.take(rules("0xabc", "ip9"), t0 + 11 * 60_000), null);
  // One network with fresh signers each time (signatures are free): 4 per 10 minutes, 7 per hour.
  const byIp = createLimiter();
  for (let i = 0; i < 4; i += 1) assert.equal(byIp.take(rules(`0x${i}`, "1.1.1.1"), t0 + i), null);
  assert.equal(byIp.take(rules("0x9", "1.1.1.1"), t0 + 10).key, "ip:1.1.1.1");
  for (let i = 0; i < 3; i += 1) assert.equal(byIp.take(rules(`0xa${i}`, "1.1.1.1"), t0 + 11 * 60_000 + i), null);
  assert.equal(byIp.take(rules("0xb", "1.1.1.1"), t0 + 22 * 60_000).key, "ip-hour:1.1.1.1");
  // One person can never use up the global quota alone.
  const ipHour = rules("0x1", "x").find((rule) => rule.key === "ip-hour:x");
  assert.ok(ipHour.max < rules("0x1", "x").find((rule) => rule.key === "all").max);
  // Global per hour, and a daily cap for the account.
  const global = createLimiter();
  for (let i = 0; i < 3; i += 1) global.take(rules(`0x${i}`, `ip${i}`, 3), t0);
  assert.equal(global.take(rules("0x9", "ip9", 3), t0).key, "all");
  assert.equal(rules("0x1", "x", 30).find((rule) => rule.key === "all-day").max, 180);
  // A signed note goes out once.
  const limiter = createLimiter();
  assert.equal(limiter.once("digest", t0), true);
  assert.equal(limiter.once("digest", t0 + 1000), false);
  assert.equal(limiter.once("digest", t0 + 16 * 60_000), true);
});

await test("read: only our conversations; channel posts are tied to the restaurants they link", async () => {
  const cast = (parentUrl, extra = {}) => ({ hash: "0x" + "1".repeat(40), data: { type: "MESSAGE_TYPE_CAST_ADD", fid: 1, timestamp: 1, castAddBody: { text: "", embeds: [], parentUrl, ...extra } } });
  const config = { mesasaysFid: null, origins: ORIGINS, channel: "https://farcaster.xyz/~/channel/mesasays" };
  assert.equal(isOurs(cast("https://mesasays.com/say"), config), true);
  assert.equal(isOurs(cast("https://mesasays.com/restaurants/galea"), config), true);
  assert.equal(isOurs(cast("https://farcaster.xyz/~/channel/mesasays"), config), true);
  assert.equal(isOurs(cast("https://farcaster.xyz/~/channel/mesasays"), { ...config, channel: null }), false);
  assert.equal(isOurs(cast("https://ethereum.org"), config), false);
  assert.equal(isOurs(cast(null, { parentCastId: { fid: 2, hash: "0x" + "2".repeat(40) } }), config), false);
  const post = cast(config.channel, {
    text: "Best pasta? https://mesasays.com/es/restaurantes/galea and Lorea",
    embeds: [{ url: "https://www.mesasays.com/restaurants/lorea" }, { url: "https://example.com/restaurants/nope" }],
  });
  assert.deepEqual(linkedSlugs(post).sort(), ["galea", "lorea"]);
});

/* ---------------- public hubs (read-only) ---------------- */

if (process.env.SKIP_LIVE) {
  console.log("--  live hub tests skipped (SKIP_LIVE)");
} else {
  const FOOD = "https://warpcast.com/~/channel/food";
  // An older channel whose topic is a chain:// URL. (The /food channel's topic listing comes back empty
  // for pages of 4+ casts on the current hubs, a hub-side quirk with one of its casts; our topics are new.)
  const CHANNEL = "chain://eip155:1/erc721:0x05acde54e82e7e38ec12c5b5b4b1fd1c8d32658d";

  await test("hub: reads casts under a topic URL from a public hub", async () => {
    const casts = await castsByTopic(CHANNEL, 1);
    assert.ok(casts.length > 0, "no casts");
    assert.ok(casts.every((cast) => cast.data.castAddBody.parentUrl === CHANNEL));
    assert.match(casts[0].hash, /^0x[0-9a-f]{40}$/);
  });

  await test("hub: falls back to the next hub when the first is down", async () => {
    const casts = await castsByTopic(CHANNEL, 1, ["https://hub.invalid", "https://haatz.quilibrium.com"]);
    assert.ok(casts.length > 0);
  });

  await test("hub: replies, profiles and a full conversation parse into what Say shows", async () => {
    // A 2026 cast in the /ethereum channel (topic https://ethereum.org) that has a reply.
    const ID = "3354831-0x0ee0ce2e33caa272dbda2a8d230c4ceadd1af6b1";
    const ETH = "https://ethereum.org";
    const root = await castById(3354831, "0x0ee0ce2e33caa272dbda2a8d230c4ceadd1af6b1");
    assert.ok(root, "known cast not found");
    const replies = await repliesTo(3354831, root.hash);
    assert.ok(replies.length > 0);
    assert.ok(replies.every((reply) => reply.data.castAddBody.parentCastId.hash === root.hash));
    const dwr = await profile(3);
    assert.equal(dwr.username, "dwr");
    assert.equal(castText({ text: "hi  and ", mentions: [3], mentionsPositions: [3] }, new Map([[3, "dwr"]])), "hi @dwr and ");
    // Not one of ours: a random Farcaster cast must never render as a MesaSays page.
    assert.equal(await getFarcasterThread(ID, { mesasaysFid: null, origins: ORIGINS }), null);
    // The same cast, with that channel declared as ours, reads as a conversation.
    const conversation = await getFarcasterThread(ID, { mesasaysFid: null, origins: ORIGINS, channel: ETH });
    assert.equal(conversation.id, ID);
    assert.equal(conversation.topic, ETH);
    assert.equal(conversation.source.kind, "farcaster");
    assert.ok(conversation.replies.length > 0);
    assert.ok(conversation.replies.every((reply) => /^\d+-0x[0-9a-f]{40}$/.test(reply.id) && reply.createdAt.startsWith("20")));
    assert.ok(conversation.author.length > 0 && conversation.title.length > 0);
  });

  await test("hub: every message is re-checked; a genuine one passes, an altered one is rejected", async () => {
    const root = await castById(3354831, "0x0ee0ce2e33caa272dbda2a8d230c4ceadd1af6b1");
    assert.equal(await verifyHubMessage(root), true);
    const replies = await repliesTo(3354831, root.hash);
    for (const reply of replies.slice(0, 5)) assert.equal(await verifyHubMessage(reply), true, "genuine reply refused");
    const altered = structuredClone(root);
    altered.data.castAddBody.text += " (edited by a hub)";
    assert.equal(await verifyHubMessage(altered), false);
    const otherAuthor = structuredClone(root);
    otherAuthor.data.fid += 1;
    assert.equal(await verifyHubMessage(otherAuthor), false);
    assert.equal(await verifyHubMessage({ ...root, signature: undefined }), false);
  });

  await test("hub: our topics read cleanly (empty is fine)", async () => {
    const casts = await castsByTopic(topicUrl("galea"), 1);
    assert.ok(Array.isArray(casts));
  });
}

console.log(`\n${passed} tests passed`);
