#!/usr/bin/env node
// Checks the author's signature on a Say post published on Farcaster, straight from a public hub.
// Needs no MesaSays server, no database, no account:
//
//   node scripts/verify-cast.mjs <fid>-<hash>        e.g. node scripts/verify-cast.mjs 1234-0xabc...
//   SAY_FARCASTER_HUBS=https://my-hub:3381 node scripts/verify-cast.mjs ...
//   SAY_PASSKEY_ORIGINS=https://mesasays.com,http://localhost:3206 ...   (sites a passkey may sign for)
import { castById } from "../lib/say/farcaster/hub.ts";
import { parseCastKey, readRelayed } from "../lib/say/relayed.ts";

const key = parseCastKey(String(process.argv[2] ?? "").toLowerCase());
if (!key) {
  console.error("usage: node scripts/verify-cast.mjs <fid>-<0x hash>");
  process.exit(2);
}
const origins = (process.env.SAY_PASSKEY_ORIGINS || "https://mesasays.com").split(",").map((value) => value.trim());
const cast = await castById(key.fid, key.hash);
if (!cast) {
  console.error("cast not found on the hubs");
  process.exit(1);
}
const body = cast.data.castAddBody;
const read = await readRelayed(
  { fid: cast.data.fid, hash: cast.hash, text: body.text ?? "", embeds: (body.embeds ?? []).map((embed) => embed.url).filter(Boolean), parentUrl: body.parentUrl ?? null, parentCastId: body.parentCastId ?? null },
  origins,
);
console.log(`cast    ${key.fid}-${cast.hash}  (${body.parentUrl ?? `reply to ${body.parentCastId?.fid}-${body.parentCastId?.hash}`})`);
if (!read) {
  console.log("result  not a MesaSays relayed post (no Say footer)");
  process.exit(0);
}
console.log(`author  ${read.author}`);
if (read.kind === "migrated") {
  console.log(`result  migrated from the old Say (${read.date}); original signature, if any, in the archive ${read.archive ?? "(none linked)"}`);
} else if (!read.proof) {
  console.log("result  not signed");
} else if (read.proof.status === "valid") {
  console.log(`result  VALID: signed by ${read.proof.method === "passkey" ? `passkey ${read.proof.signer} (public key ${read.proof.passkey.publicKey})` : read.proof.signer}`);
  console.log(JSON.stringify(read.proof.payload, null, 2));
} else {
  console.log("result  INVALID: the signature does not match this cast");
  process.exitCode = 1;
}
