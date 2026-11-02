# Signed notes on Say

Anyone can post on Say under any name. A **signed note** adds proof: the author signs the post with an
Ethereum wallet (Rabby, MetaMask…), and anyone can check, without us, that this exact text was signed by
that address. Signing is free: it is an [EIP-712](https://eips.ethereum.org/EIPS/eip-712) typed-data
signature (`eth_signTypedData_v4`), not a transaction. No gas, no chain, nothing on-chain.

The signature, not our database, is the proof. The signed JSON is self-contained, so a note can be moved
elsewhere (the plan is to publish signed notes on Farcaster and drop our database) and still be checked.

Unsigned posting stays possible; those posts show "not signed".

## What is signed

Domain (no `chainId`, no `verifyingContract`: an off-chain statement, valid on no chain in particular):

```json
{ "name": "MesaSays", "version": "1" }
```

One primary type, `Note`:

| field       | type      | value |
|-------------|-----------|-------|
| `kind`      | `string`  | `"thread"` (new conversation) or `"reply"` |
| `place`     | `string`  | restaurant slug the conversation was started from (`mesasays.com/restaurants/<slug>`), or `""` |
| `thread`    | `string`  | reply: id of the conversation; thread: `""` |
| `parent`    | `string`  | reply to a reply: id of that reply; otherwise `""` |
| `title`     | `string`  | thread: the headline as shown; reply: `""` |
| `text`      | `string`  | thread: the details under the headline as shown (may be `""`); reply: the reply as shown |
| `author`    | `string`  | the display name as shown |
| `createdAt` | `uint256` | unix seconds when the author signed |

Solidity-style: `Note(string kind,string place,string thread,string parent,string title,string text,string author,uint256 createdAt)`.

Source of truth: `lib/say/signature.ts` (shared by the browser and the server).

Rules the site applies:

- The browser builds the note from the exact text being posted, with the same normalisation as the server
  (trim; a new post is split into headline + details; names keep letters, digits, `_` and `.`, 20 max).
- The server rebuilds the note from the fields it is about to store and verifies the signature (viem
  `verifyTypedData`, offline). It refuses the post if the signature does not match, or if `createdAt` is more
  than 10 minutes away from the server clock. The signer is stored in checksum format.
- Every time a post is displayed, the server checks the stored signature again against the text it shows.
  A row whose text or signer was changed after signing shows "signature invalid", never "signed".
- Ordinary wallets only (EOA, 65-byte signatures). Smart-contract wallets (ERC-1271) are not supported yet:
  checking them needs a call to the chain.

## What a signature proves, and what it does not

It proves that whoever controls the address signed this exact text, at the time it says (give or take 10
minutes, checked when posted). It does **not** prove a name: anyone can type any name. The site labels the
addresses it knows (`lib/say/signers.ts`; for now `0xA730C2926E1d4aD3E6B91e1c12Db787645250350` =
"jules · mesasays", MesaSays team). Any other signer is shown by address.

`thread` and `parent` are our database ids for now: they say which conversation a reply belongs to, they do
not prove the conversation's own content. The conversation's note carries its own signature.

## Verify one yourself

On a conversation page, open **Verify** under a signed post: it shows the signer, the signature and the
exact signed JSON (the `eth_signTypedData_v4` format). Paste them into any EIP-712 tool, or:

### viem

```js
// npm i viem   then   node verify.mjs
import { verifyTypedData } from "viem";

const signer = "0xB09507e04f006f56215C46Cc278b79c12b10f46f";
const signature = "0x80ef406fe3bfb6308a37d1faa98eda6c758c997844b3e34a31b737d3b4ad8bcb72d2f4d8bc1c103e0d02a83c2fc6c574c98112931a2081cf33cffadd1db100801b";
const payload = {
  types: {
    EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }],
    Note: [
      { name: "kind", type: "string" }, { name: "place", type: "string" }, { name: "thread", type: "string" },
      { name: "parent", type: "string" }, { name: "title", type: "string" }, { name: "text", type: "string" },
      { name: "author", type: "string" }, { name: "createdAt", type: "uint256" },
    ],
  },
  domain: { name: "MesaSays", version: "1" },
  primaryType: "Note",
  message: {
    kind: "thread", place: "galea", thread: "", parent: "",
    title: "Galea: order the cacio e pepe.", text: "Skip the tiramisu.",
    author: "taco_hunter", createdAt: 1793404800,
  },
};

console.log(await verifyTypedData({ address: signer, signature, ...payload })); // true
```

### ethers v6

ethers derives the domain type itself: remove `EIP712Domain` from `types` first.

```js
// npm i ethers   then   node verify.mjs   (same signer, signature and payload as above)
import { verifyTypedData } from "ethers";

const { EIP712Domain, ...types } = payload.types;
const recovered = verifyTypedData(payload.domain, types, payload.message, signature);
console.log(recovered === signer); // true
```

Change one character of `text` or `author` and the check fails (viem: `false`; ethers: another address).

The example above was signed by a throwaway key made for this document, not by a MesaSays address.

## Storage (transition)

`supabase/say/20261101000000_signed_notes.sql` adds `signer`, `signature`, `signed_at` and `signed_payload`
(the full JSON) to `say_threads` and `say_replies`, and two functions, `say_post_signed` and
`say_reply_signed`. Postgres cannot check an Ethereum signature: those functions only check that the stored
columns say what the signed message says, then store what our server verified. That is why the site checks
the signature again on display, and why the signature alone is the proof.

Until that SQL is applied, the site keeps working: it reads without the new columns (every post "not
signed") and refuses signed posts with a message asking to post without signing.

## Tests

`node scripts/test-signed-notes.mjs` signs notes with a throwaway key and checks that the server logic
accepts them and refuses tampered text, tampered author, another place, the wrong signer and a stale
`createdAt`.
