#!/usr/bin/env node
// Prints what to put on mesasays.eth for a given IPFS CID. Sends nothing, signs nothing.
//
//   node infra/ens-contenthash.mjs <CID> [name.eth] [resolver]
//
// Output: the ENS-encoded content hash (EIP-1577), the name's namehash, and the calldata of
// setContenthash(bytes32,bytes) on the resolver, for anyone who prefers to send it from a
// wallet's "custom transaction" screen. The simple way is the ENS app (docs/INFRA_EU.md).
// Needs Foundry's `cast` for keccak (namehash) and ABI encoding.
import { execFileSync } from "node:child_process";

const [cid, name = "mesasays.eth", resolver = "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63"] = process.argv.slice(2);
if (!cid) {
  console.error("usage: node infra/ens-contenthash.mjs <CID> [name.eth] [resolver]");
  process.exit(2);
}

function base32Decode(text) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let bits = 0, value = 0;
  const out = [];
  for (const char of text) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error(`not base32: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function base58Decode(text) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = 0n;
  for (const char of text) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error(`not base58: ${char}`);
    number = number * 58n + BigInt(index);
  }
  let hex = number.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const leading = text.match(/^1*/)[0].length;
  return Uint8Array.from([...new Array(leading).fill(0), ...Buffer.from(hex, "hex")]);
}

/** CID string -> binary CIDv1 (version 0x01, codec, multihash). */
function cidBytes(text) {
  if (text.startsWith("Qm")) return Uint8Array.from([0x01, 0x70, ...base58Decode(text)]); // CIDv0 = dag-pb sha2-256
  if (text.startsWith("b")) {
    const bytes = base32Decode(text.slice(1).toLowerCase());
    if (bytes[0] !== 0x01) throw new Error("not a CIDv1");
    return bytes;
  }
  throw new Error("give a CIDv1 in base32 (bafy...) or a CIDv0 (Qm...)");
}

const hex = (bytes) => Buffer.from(bytes).toString("hex");
// EIP-1577: ipfs-ns multicodec (0xe3, as varint e3 01) followed by the binary CID.
const contenthash = `0xe301${hex(cidBytes(cid))}`;

const cast = (...args) => execFileSync("cast", args, { encoding: "utf8" }).trim();
let node = "(install Foundry for this: cast namehash)";
let calldata = "(install Foundry for this: cast calldata)";
try {
  node = cast("namehash", name);
  calldata = cast("calldata", "setContenthash(bytes32,bytes)", node, contenthash);
} catch {
  // cast not installed: the content hash above is all the ENS app needs.
}

console.log(`Name:            ${name}
Content hash:    ipfs://${cid}   <- paste this in the ENS app (Records -> Content hash)
Encoded value:   ${contenthash}
Namehash:        ${node}
Resolver:        ${resolver}   (ENS Public Resolver; check the name's actual resolver in the ENS app)
Calldata:        ${calldata}
Check after:     cast call ${resolver} "contenthash(bytes32)(bytes)" ${node} --rpc-url <an Ethereum RPC>`);
