"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { fromB64url } from "@/lib/say/passkey";
import { parseCastKey, readRelayed, type ReadNote } from "@/lib/say/relayed";
import "./say.css";

// Decodes the proof carried in the link (after "#"), and checks a whole cast fetched straight from a
// public Farcaster hub, in this browser. Our server is not involved: the same code runs offline in
// scripts/verify-cast.mjs. Format: docs/SAY_FARCASTER.md.

const HUB = "https://haatz.quilibrium.com";
const ORIGINS = ["https://mesasays.com"];
const MESASAYS_FID = 3357281;

const subscribeHash = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
};
const useHash = () => useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => "");

function decodeFields(encoded: string) {
  const fields = encoded.split("~");
  const text = (value: string) => {
    try {
      return new TextDecoder().decode(fromB64url(value));
    } catch {
      return "?";
    }
  };
  if (fields[0] !== "1") return null;
  const createdAt = parseInt(fields[3] ?? "", 36);
  return {
    method: fields[1] === "p" ? "passkey (WebAuthn, P-256)" : fields[1] === "e" ? "Ethereum wallet (EIP-712)" : "unknown",
    author: text(fields[2] ?? ""),
    signedAt: Number.isFinite(createdAt) ? new Date(createdAt * 1000).toISOString() : "?",
    raw: fields,
  };
}

type HubCast = { data: { fid: number; castAddBody: { text: string; embeds: Array<{ url?: string }>; parentUrl?: string | null; parentCastId?: { fid: number; hash: string } | null } }; hash: string };

export function ProofView() {
  const hash = useHash();
  const decoded = hash && !hash.startsWith("+") ? decodeFields(decodeURIComponent(hash)) : null;
  const [castId, setCastId] = useState("");
  const [result, setResult] = useState<ReadNote | null | "error" | "loading">(null);
  // Who published the cast: a valid author signature means more when the MesaSays account relayed it.
  const [fromFid, setFromFid] = useState<number | null>(null);

  async function check(event: FormEvent) {
    event.preventDefault();
    const key = parseCastKey(castId.trim().toLowerCase());
    if (!key) return setResult("error");
    setResult("loading");
    try {
      const response = await fetch(`${HUB}/v1/castById?fid=${key.fid}&hash=${key.hash}`);
      const cast = (await response.json()) as HubCast;
      const body = cast.data.castAddBody;
      const read = await readRelayed(
        { fid: cast.data.fid, hash: cast.hash, text: body.text, embeds: body.embeds.map((embed) => embed.url ?? "").filter(Boolean), parentUrl: body.parentUrl ?? null, parentCastId: body.parentCastId ?? null },
        ORIGINS,
      );
      setFromFid(cast.data.fid);
      setResult(read);
    } catch {
      setResult("error");
    }
  }

  return (
    <div className="say">
      <p className="say-page-lede">
        Posts written on mesasays.com are published on Farcaster by the MesaSays account. The author&apos;s own
        signature (a passkey or an Ethereum wallet) travels inside the post, in a link to this page. Every
        Farcaster hub keeps a copy, so anyone can check it later without us.
      </p>
      {decoded ? (
        <div className="say-verify-body">
          <p className="say-meta"><span className="say-dim">Signed by</span> {decoded.author} · {decoded.method}</p>
          <p className="say-meta"><span className="say-dim">Signed at</span> {decoded.signedAt}</p>
          <p className="say-meta"><span className="say-dim">Fields</span></p>
          <pre className="say-json">{decoded.raw.join("\n")}</pre>
        </div>
      ) : (
        <p className="say-meta say-dim">No proof in this link.</p>
      )}
      <form className="say-composer" onSubmit={check} style={{ marginTop: 16 }}>
        <label className="say-field">
          <span className="say-meta">Check a whole cast: its id, as fid-hash (e.g. 1234-0xabc…)</span>
          <input value={castId} onChange={(event) => setCastId(event.target.value)} placeholder="1234-0x51cadef76bbe26174a83ed5fb14b951bd00a5eef" autoComplete="off" />
        </label>
        <div className="say-row"><span className="say-meta say-dim">Read from {HUB}, checked in your browser.</span><button type="submit" className="say-primary">Check</button></div>
        {result === "loading" ? <p className="say-meta">Reading the hub…</p> : null}
        {result === "error" ? <p className="say-error">Couldn&apos;t read that cast.</p> : null}
        {result && typeof result === "object" ? (
          result.kind === "relayed" && result.proof?.status === "valid" ? (
            <>
              <p className="say-meta">Valid: {result.author} signed this exact text with {result.proof.method === "passkey" ? `passkey ${result.proof.signer}` : result.proof.signer}.</p>
              <p className="say-meta">
                {fromFid === MESASAYS_FID
                  ? `Published by the MesaSays account (fid ${MESASAYS_FID}).`
                  : `Published by fid ${fromFid}, not the MesaSays account (fid ${MESASAYS_FID}): someone copied this note.`}
              </p>
            </>
          ) : result.kind === "relayed" && result.proof ? (
            <p className="say-error">Invalid: the signature does not match this cast.</p>
          ) : (
            <p className="say-meta">This cast carries no signature (not signed, or migrated from the old Say).</p>
          )
        ) : null}
      </form>
    </div>
  );
}
