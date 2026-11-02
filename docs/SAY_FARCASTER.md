# Say on Farcaster

Say (the conversations on restaurant pages and at /say) lives on the open Farcaster network, not in our
database: `SAY_BACKEND=farcaster`. Status on 2026-11-01: **reading and writing are live.** The MesaSays account
is fid 3357281 (custody and recovery 0xA730…0350 on Optimism), app key `0x3359…43d5` (`MESASAYS_APP_KEY` in
`lib/say/farcaster/config.ts`). The two Supabase-era conversations are migrated with
`scripts/migrate-say-to-farcaster.mjs` (export in `supabase/say/export/`).

## Who can write

- **On Farcaster already**: reply from any app (Firefly, Farcaster…) under a MesaSays conversation; once the
  /mesasays channel exists, post there with a link to a restaurant page.
- **Not on Farcaster**: write on mesasays.com and sign with a **passkey** (Face ID, fingerprint; no account) or
  an Ethereum wallet. The MesaSays account publishes the note with the author's signature in the embeds.
  Unsigned posts are refused unless `SAY_RELAY_ALLOW_UNSIGNED=1`.
- Safari allows one passkey prompt per tap: creating the passkey is its own button ("Create my passkey"),
  then Post signs. "I already have one" takes two taps (two signatures recover the public key).

## Where conversations live

| What | Farcaster "topic" (parent URL) |
|---|---|
| A restaurant | `https://mesasays.com/restaurants/<slug>` |
| General (/say) | `https://mesasays.com/say` |
| The /mesasays channel (once Jules creates it) | its parent URL, set in `SAY_FARCASTER_CHANNEL_URL` |

Most Farcaster apps cannot post under an arbitrary URL; they post in channels. So once the channel exists,
a post in /mesasays that links a restaurant page (embed or text, English or Spanish URL) shows on that
restaurant, and every channel post shows in /say. Posts written from mesasays.com go straight under the
restaurant's own topic, relayed by the MesaSays account.

A conversation id is `<fid>-<hash>` (e.g. `/say/3354831-0x0ee0…`). Replies are read three levels deep.

## What we check on every read

- **Only our conversations.** `/say/<id>` renders a cast only if it hangs from one of the topics above.
  Any other Farcaster cast gives a 404 (`isOurs` in `lib/say/farcaster/read.ts`).
- **Every message's signature.** We rebuild the message bytes, recompute its BLAKE3 hash and check the
  Ed25519 signature (`verifyHubMessage` in `lib/say/farcaster/message.ts`). A hub that altered a text, a
  link or an author is caught, and that message is not shown. Not re-checked here: that the signing key
  belongs to the account (hubs check that against the Optimism key registry).
  - Trap: hubs write hashes and keys in hex where the protobuf JSON format expects base64; converting
    them first is what makes genuine messages pass.
  - Limit: some 2023–2024 casts no longer re-encode to their original bytes and fail; they are hidden.
    All recent casts tested pass. Say topics are new, so this only matters if old casts get linked.
- **Relayed notes** (written on mesasays.com, posted by the MesaSays account) carry the author's own
  signature (wallet or passkey); it is checked against the cast's text. Public check: `/proof`, or
  `node scripts/verify-cast.mjs <fid>-<hash>`.

## Hubs

Default: `https://haatz.quilibrium.com` only (independent operator, open CORS, no key). The Farcaster
company's own nodes work but are left out on purpose: Jules' rule is "no centralized US service, not even
as a fallback". Planned fallback: our own hub in the EU. Override with `SAY_FARCASTER_HUBS` (comma list,
tried in order; the last good answer is reused for 30 s).

## Settings (Vercel → Settings → Environment Variables)

| Variable | Meaning |
|---|---|
| `SAY_BACKEND=farcaster` | read (and write) Say on Farcaster |
| `SAY_FARCASTER_CHANNEL_URL` | the /mesasays channel's parent URL, once it exists |
| `SAY_FARCASTER_HUBS` | hubs to read from (optional) |
| `SAY_FARCASTER_FID` | the MesaSays account's fid: `3357281` |
| `SAY_FARCASTER_SIGNER_KEY` | its Ed25519 app key, 64 hex characters, **secret, Vercel only** |
| `SAY_FARCASTER_RELAY` | `off` / `dry-run` (default) / `live`; `live` needs the two above |
| `SAY_PASSKEY_ORIGINS` | sites allowed to ask for passkey signatures (`https://mesasays.com,https://www.mesasays.com`) |
| `SAY_RELAY_ALLOW_UNSIGNED` | `1` to relay unsigned posts too (default: refused) |
| `SAY_RELAY_MAX_PER_HOUR` | relayed posts per hour per server instance, all authors (default 30; daily cap = 6×) |

Relay safeguards (audit 2026-11-01): a reply is relayed only under a verified MesaSays conversation (and its
parent must belong to it); the cast timestamp comes from the signed note, so a replayed note gives the same
message and hubs refuse the duplicate; a dry run signs with a throwaway key; per-IP limits sit below the global
one (4 per 10 min, a quarter of the hourly quota); casts from fid 3357281 must be signed by `MESASAYS_APP_KEY`.
Counters are per server instance (no shared store, on purpose): the account-wide daily cap bounds abuse.

## Tests

```
node scripts/test-say-farcaster.mjs     # 22 tests; SKIP_LIVE=1 skips the public-hub reads
node scripts/test-signed-notes.mjs      # 14 tests
```

## Still to do

1. The /mesasays channel (Jules creates it; public act), then set `SAY_FARCASTER_CHANNEL_URL`.
2. A username and profile for the account (`mesasays.eth` as an ENS username needs a proof Jules signs).
3. Moderation: a way to hide a reply under a MesaSays conversation, and a public log.
4. A second, independent hub (ours, EU) as fallback.
5. Delete the Supabase project `zwnpwnqyqnhqxafjorte`, with Jules' OK, once production has run on Farcaster.
