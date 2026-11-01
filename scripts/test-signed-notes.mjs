// Tests the Say signed-notes logic without a browser wallet or a database.
//
//   node scripts/test-signed-notes.mjs
//
// Uses a throwaway private key (generated on each run, never saved). Imports lib/say/signature.ts
// directly: Node 22.18+ strips the TypeScript types itself.
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyTypedData as viemVerify } from "viem";
import {
  NOTE_DOMAIN, NOTE_TYPES, MAX_SKEW_SECONDS, notePayload, threadNote, replyNote, verifyNote, prepareThread, prepareReply, checkStored,
} from "../lib/say/signature.ts";

const author = privateKeyToAccount(generatePrivateKey());
const stranger = privateKeyToAccount(generatePrivateKey());
const now = Math.floor(Date.now() / 1000);
const THREAD = "3f1c2a9e-0b7d-4c55-9a1e-2d6f8b0c4e11";
const PARENT = "7a0e4b2c-5d19-4f3a-8c6b-1e9d2f7a3b58";

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok  ${name}`);
}

/** What the browser does: the wallet signs the JSON from notePayload (eth_signTypedData_v4). */
async function sign(account, note) {
  const { types, domain, primaryType, message } = notePayload(note);
  const noteTypes = { Note: types.Note }; // viem derives the domain type itself
  return account.signTypedData({ domain, types: noteTypes, primaryType, message: { ...message, createdAt: BigInt(message.createdAt) } });
}

const placeExists = async (slug) => slug === "galea";
const isId = (value) => /^[0-9a-f-]{36}$/.test(value);

const text = "Galea: order the cacio e pepe.\nSkip the tiramisu, it was dry on a Tuesday night.";
const thread = threadNote({ author: "jules", text, place: "galea", createdAt: now });
const threadSig = await sign(author, thread);

await test("payload is the documented EIP-712 type", async () => {
  assert.deepEqual(NOTE_DOMAIN, { name: "MesaSays", version: "1" });
  assert.deepEqual(NOTE_TYPES.Note.map((f) => `${f.type} ${f.name}`), [
    "string kind", "string place", "string thread", "string parent", "string title", "string text", "string author", "uint256 createdAt",
  ]);
  assert.deepEqual(thread, { kind: "thread", place: "galea", thread: "", parent: "", title: "Galea: order the cacio e pepe.", text: "Skip the tiramisu, it was dry on a Tuesday night.", author: "jules", createdAt: now });
});

await test("a third party can verify the stored JSON with plain viem", async () => {
  const payload = JSON.parse(JSON.stringify(notePayload(thread)));
  const types = { Note: payload.types.Note };
  assert.equal(await viemVerify({ address: author.address, domain: payload.domain, types, primaryType: payload.primaryType, message: payload.message, signature: threadSig }), true);
});

await test("a wallet given the full v4 JSON (EIP712Domain included, createdAt as a number) signs the same thing", async () => {
  const json = JSON.parse(JSON.stringify(notePayload(thread)));
  const sig = await author.signTypedData(json);
  assert.equal(sig, threadSig);
});

await test("server accepts a valid signed thread, checksummed signer", async () => {
  const result = await prepareThread({ author: "jules", text, slug: "galea", signed: { signer: author.address.toLowerCase(), signature: threadSig, createdAt: now } }, { placeExists, now });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.proof.signer, author.address);
  assert.deepEqual(result.post, { author: "jules", title: thread.title, body: thread.text, slug: "galea" });
  assert.deepEqual(result.proof.payload.message, thread);
});

await test("unsigned posting still works", async () => {
  const result = await prepareThread({ author: "jules", text, slug: "galea" }, { placeExists, now });
  assert.equal(result.ok, true);
  assert.equal(result.proof, null);
});

await test("rejects tampered text", async () => {
  const result = await prepareThread({ author: "jules", text: text.replace("cacio e pepe", "carbonara"), slug: "galea", signed: { signer: author.address, signature: threadSig, createdAt: now } }, { placeExists, now });
  assert.equal(result.ok, false);
  assert.match(result.error, /doesn't match/);
});

await test("rejects tampered author", async () => {
  const result = await prepareThread({ author: "sofi", text, slug: "galea", signed: { signer: author.address, signature: threadSig, createdAt: now } }, { placeExists, now });
  assert.equal(result.ok, false);
  assert.match(result.error, /doesn't match/);
});

await test("rejects a different place (signed for galea, posted elsewhere or place unknown)", async () => {
  const result = await prepareThread({ author: "jules", text, slug: "nowhere", signed: { signer: author.address, signature: threadSig, createdAt: now } }, { placeExists, now });
  assert.equal(result.ok, false);
});

await test("rejects wrong signer (signature by someone else)", async () => {
  const result = await prepareThread({ author: "jules", text, slug: "galea", signed: { signer: stranger.address, signature: threadSig, createdAt: now } }, { placeExists, now });
  assert.equal(result.ok, false);
  assert.match(result.error, /doesn't match/);
});

await test("rejects stale createdAt (11 minutes old), even with a valid signature", async () => {
  const old = threadNote({ author: "jules", text, place: "galea", createdAt: now - MAX_SKEW_SECONDS - 60 });
  const sig = await sign(author, old);
  assert.equal((await verifyNote(old, { signer: author.address, signature: sig })).ok, true, "valid without the freshness check");
  const result = await prepareThread({ author: "jules", text, slug: "galea", signed: { signer: author.address, signature: sig, createdAt: old.createdAt } }, { placeExists, now });
  assert.equal(result.ok, false);
  assert.match(result.error, /10 minutes/);
});

await test("rejects createdAt changed after signing", async () => {
  const result = await prepareThread({ author: "jules", text, slug: "galea", signed: { signer: author.address, signature: threadSig, createdAt: now - 5 } }, { placeExists, now });
  assert.equal(result.ok, false);
});

await test("rejects malformed signer and signature", async () => {
  assert.equal((await verifyNote(thread, { signer: "0x1234", signature: threadSig })).ok, false);
  assert.equal((await verifyNote(thread, { signer: author.address, signature: "0xdeadbeef" })).ok, false);
});

await test("reply: accepts valid, rejects tampered body and moved to another parent", async () => {
  const reply = replyNote({ author: "chloé", text: "  Agreed, and get the bread.  ", threadId: THREAD, parentId: PARENT, createdAt: now });
  const sig = await sign(author, reply);
  const signed = { signer: author.address, signature: sig, createdAt: now };
  const good = await prepareReply({ threadId: THREAD, parentId: PARENT, author: "chloé", body: "  Agreed, and get the bread.  ", signed }, { isId, now });
  assert.equal(good.ok, true, good.error);
  assert.equal(good.post.body, "Agreed, and get the bread.");
  assert.equal((await prepareReply({ threadId: THREAD, parentId: PARENT, author: "chloé", body: "Agreed, skip the bread.", signed }, { isId, now })).ok, false);
  assert.equal((await prepareReply({ threadId: THREAD, parentId: null, author: "chloé", body: "Agreed, and get the bread.", signed }, { isId, now })).ok, false);
});

await test("read side: stored row re-verified; edited row or forged signature shows invalid", async () => {
  const stored = { signer: author.address, signature: threadSig, payload: JSON.parse(JSON.stringify(notePayload(thread))) };
  const shown = { kind: "thread", thread: "", parent: "", title: thread.title, text: thread.text, author: "jules" };
  assert.equal((await checkStored(stored, shown)).status, "valid");
  assert.equal((await checkStored(stored, { ...shown, text: "edited in the dashboard" })).status, "invalid");
  assert.equal((await checkStored({ ...stored, signer: stranger.address }, shown)).status, "invalid");
  assert.equal(await checkStored({ signer: null, signature: null, payload: null }, shown), null);
});

console.log(`\n${passed} tests passed (throwaway signer ${author.address})`);
