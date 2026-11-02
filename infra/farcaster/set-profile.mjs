// Gives the MesaSays Farcaster account (fid 3357281) its name and profile.
//
//   node infra/farcaster/set-profile.mjs <timestamp> <signature>          dry run: builds and checks everything
//   node infra/farcaster/set-profile.mjs <timestamp> <signature> --live   publishes
//
// <timestamp> <signature> come from step 5 of the local page /dev/farcaster-account: Jules signs, free and
// with no transaction, "0xA730…0350 owns mesasays.eth" (EIP-712, domain "Farcaster name verification").
// Then, signed with the account's app key (.env.local, never shown):
//   1. a USERNAME_PROOF message (type ENS_L1): hubs check on Ethereum that mesasays.eth resolves to the
//      account's custody address;
//   2. profile data: username mesasays.eth, display name, bio, website, picture.
import { readFileSync, existsSync } from "node:fs";
import { getAddress, verifyTypedData } from "viem";
import {
  FarcasterNetwork, Message, NobleEd25519Signer, UserDataType, UserNameType, eip712, makeUserDataAdd, makeUsernameProof,
} from "@farcaster/core";
import { hubSubmit, hubList, FARCASTER_EPOCH_MS } from "../../lib/say/farcaster/hub.ts";
import { hexToBytes } from "../../lib/say/passkey.ts";

// --fname <name>: a Farcaster name from the fname registry (fnames.farcaster.xyz) instead of an ENS name.
const fnameIndex = process.argv.indexOf("--fname");
const FNAME = fnameIndex > 0 ? process.argv[fnameIndex + 1] : null;
const NAME = FNAME ?? "mesasays.eth";
const OWNER = getAddress("0xA730C2926E1d4aD3E6B91e1c12Db787645250350");
const PROFILE = [
  [UserDataType.DISPLAY, "MesaSays"],
  [UserDataType.BIO, "The restaurant guide written by the people who eat and the people who cook. Mexico City first. No restaurant pays to be here."],
  [UserDataType.URL, "https://mesasays.com"],
  [UserDataType.PFP, "https://mesasays.com/apple-icon"],
];

// --profile-only: display name, bio, website, picture; no username (needs no Ethereum check by the hub).
const args = process.argv.slice(2);
const live = args.includes("--live");
const profileOnly = args.includes("--profile-only");
const [timestampArg, signature] = args.filter((arg) => !arg.startsWith("--") && arg !== FNAME);
if (!profileOnly && (!timestampArg || !signature)) throw new Error("usage: node infra/farcaster/set-profile.mjs <timestamp> <signature> [--live] | --profile-only [--live]");
const timestamp = Number(timestampArg);

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}
const fid = Number(process.env.SAY_FARCASTER_FID);
const key = (process.env.SAY_FARCASTER_SIGNER_KEY ?? "").replace(/^0x/, "");
if (!Number.isSafeInteger(fid) || !/^[0-9a-f]{64}$/i.test(key)) throw new Error("SAY_FARCASTER_FID / SAY_FARCASTER_SIGNER_KEY missing");
const signer = new NobleEd25519Signer(hexToBytes(key));

// 1. The claim really is signed by the owner, and recent (hubs refuse stale proofs).
if (!profileOnly) {
const { domain, types } = eip712.USERNAME_PROOF_EIP_712_TYPES;
const valid = await verifyTypedData({ address: OWNER, domain, types, primaryType: "UserNameProof", message: { name: NAME, timestamp: BigInt(timestamp), owner: OWNER }, signature });
if (!valid) throw new Error("The name claim is not signed by 0xA730…0350.");
const age = Math.floor(Date.now() / 1000) - timestamp;
if (age < -600 || age > 3600) throw new Error(`The claim is ${age} s old: sign it again on the page.`);
console.log(`claim: ${NAME} owned by ${OWNER}, signed ${age} s ago: valid`);
}

let clock = Math.floor((Date.now() - FARCASTER_EPOCH_MS) / 1000) - 60;
const options = () => ({ fid, network: FarcasterNetwork.MAINNET, timestamp: (clock += 1) });
async function send(label, built) {
  if (built.isErr()) throw new Error(`${label}: ${built.error.message}`);
  const bytes = Message.encode(built.value).finish();
  if (!live) return console.log(`  [dry run] ${label} (${bytes.length} bytes)`);
  const { hub } = await hubSubmit(bytes, hubList());
  console.log(`  sent ${label} (${hub})`);
}

// 2a. fname: reserve the name in the registry (same signed claim), then set it as username below.
if (FNAME) {
  const body = { name: FNAME, from: 0, to: fid, fid, owner: OWNER, timestamp, signature };
  if (!live) console.log(`  [dry run] register fname ${FNAME} → fid ${fid}`);
  else {
    const response = await fetch("https://fnames.farcaster.xyz/transfers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const text = await response.text();
    if (!response.ok) throw new Error(`fname registry refused: ${response.status} ${text.slice(0, 300)}`);
    console.log(`  registered fname ${FNAME} → fid ${fid}`);
  }
  await send(`username ${FNAME}`, await makeUserDataAdd({ type: UserDataType.USERNAME, value: FNAME }, options(), signer));
}

// 2b. ENS: the proof, then the username (the username must come after its proof).
// Note 2026-11-02: haatz refuses ENS proofs ("No client configured for chain: EthMainnet") and Farcaster's own
// hubs read the old ENS registry, where mesasays.eth (ENS v2) is absent.
if (!profileOnly && !FNAME) {
await send(`username proof ${NAME}`, await makeUsernameProof(
  { timestamp, name: new TextEncoder().encode(NAME), owner: hexToBytes(OWNER), signature: hexToBytes(signature), fid, type: UserNameType.USERNAME_TYPE_ENS_L1 },
  // The proof message carries the claim's own time (Farcaster time = unix seconds since 2021-01-01).
  { fid, network: FarcasterNetwork.MAINNET, timestamp: timestamp - FARCASTER_EPOCH_MS / 1000 }, signer,
));
await send(`username ${NAME}`, await makeUserDataAdd({ type: UserDataType.USERNAME, value: NAME }, options(), signer));
}
if (!FNAME) for (const [type, value] of PROFILE) await send(`${UserDataType[type].toLowerCase()} "${value.slice(0, 40)}"`, await makeUserDataAdd({ type, value }, options(), signer));
console.log(live ? "Done." : "Dry run: nothing sent. Add --live to publish.");
