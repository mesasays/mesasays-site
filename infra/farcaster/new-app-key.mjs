// Creates the MesaSays account's Farcaster app key (Ed25519), the key the site signs relayed posts with.
//
//   node infra/farcaster/new-app-key.mjs
//
// - The private half goes into .env.local as SAY_FARCASTER_SIGNER_KEY (git-ignored, mode 600). It is never
//   printed. For production, copy it by hand into Vercel → Settings → Environment Variables.
// - The public half goes into infra/farcaster/app-key.pub.json: the setup page registers it on Optimism.
// - Run twice, it keeps the existing key (a new key would need a new on-chain registration).
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ed25519 } from "@noble/curves/ed25519";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envFile = join(root, ".env.local");
const pubFile = join(root, "infra", "farcaster", "app-key.pub.json");
const NAME = "SAY_FARCASTER_SIGNER_KEY";

const env = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
const line = env.split("\n").find((entry) => entry.startsWith(`${NAME}=`));
let secret = line ? line.slice(NAME.length + 1).trim().replace(/^0x/, "") : "";

if (!/^[0-9a-f]{64}$/i.test(secret)) {
  secret = randomBytes(32).toString("hex");
  const block = `${env && !env.endsWith("\n") ? "\n" : ""}# MesaSays Farcaster app key (secret). Created ${new Date().toISOString()} by infra/farcaster/new-app-key.mjs\n${NAME}=${secret}\n`;
  writeFileSync(envFile, env + block);
  console.log(`New app key written to .env.local (${NAME}). The secret is not shown.`);
} else {
  console.log(`Existing app key kept (${NAME} in .env.local).`);
}
chmodSync(envFile, 0o600);

const publicKey = `0x${Buffer.from(ed25519.getPublicKey(Buffer.from(secret, "hex"))).toString("hex")}`;
writeFileSync(pubFile, `${JSON.stringify({ publicKey, createdBy: "infra/farcaster/new-app-key.mjs" }, null, 2)}\n`);
console.log(`Public key: ${publicKey}`);
console.log(`Saved to infra/farcaster/app-key.pub.json`);
