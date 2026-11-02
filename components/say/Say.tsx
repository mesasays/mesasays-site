"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { postReply, postThread } from "@/app/say/actions";
import { createPasskey, findPasskeyFinish, findPasskeyStart, passkeyLabel, passkeysSupported, PasskeyError, signNoteWithPasskey, usePasskeyIdentity, type PasskeyFirstStep, type PasskeyIdentity } from "@/components/say/passkey-client";
import { lastActivity, timeAgo, useSayName } from "@/components/say/store";
import { byteLength, castKey, topicUrl } from "@/lib/say/relayed";
import { notePayload, replyNote, shortAddress, threadNote, type Note, type SayProof, type SignedInput } from "@/lib/say/signature";
import { knownSigner } from "@/lib/say/signers";
import { DATABASE_MODE, type SayCastRef, type SayDryRun, type SayMode, type SayReply, type SayResult, type SaySource, type SayThreadData } from "@/lib/say/types";
import "./say.css";

// "Say": people ask and tell each other what to order. No accounts, no votes: a name and you post.
// Optionally signed with an Ethereum wallet (EIP-712, free, no transaction): see docs/SIGNED_NOTES.md.
// With SAY_BACKEND=farcaster, conversations live on Farcaster: posts are signed with a passkey or a wallet
// and published by the MesaSays relay; Farcaster users reply from their own app (docs/SAY_FARCASTER.md).

export type SayPlace = { slug: string; name: string; neighborhood: string | null };
type Lang = "en" | "es";

// The block on Spanish restaurant pages speaks Spanish; the conversation pages are English for now.
const COPY = {
  en: {
    peopleSay: "People say",
    replies: (n: number) => (n ? `${n} ${n === 1 ? "reply" : "replies"}` : "no reply yet"),
    sayingAs: (name: string) => `Saying as ${name}`,
    pickName: "Pick a name (no real name needed)",
    cancel: "Cancel",
    post: "Post",
    posting: "Posting…",
    seeAll: (n: number) => `See all ${n}`,
    nobody: "Nobody has said anything yet. Been here? Say what to order, and what to skip.",
    askAbout: (name: string) => `Ask or say something about ${name}…`,
    license: "What you write is public and shared under CC BY-SA 4.0: anyone may reuse it, crediting your name.",
    sign: "Sign with wallet",
    signNote: "free, no transaction",
    noWallet: "Install a wallet such as Rabby to sign.",
    signing: "Check your wallet…",
    signCancelled: "Signature cancelled. Nothing was posted.",
    signFailed: "Your wallet couldn't sign. Try again, or post without signing.",
    signed: "signed",
    notSigned: "not signed",
    invalid: "signature invalid",
    team: "MesaSays team",
    signWith: "Sign with",
    passkey: "Passkey",
    passkeyNote: "Face ID, fingerprint or your phone. No seed phrase.",
    walletOpt: "Ethereum wallet",
    noSign: "Don't sign",
    newPasskey: "First time: this creates a passkey for MesaSays on your device.",
    havePasskey: "I already have one",
    createPasskeyBtn: "Create my passkey (Face ID)",
    confirmPasskey: "Confirm with Face ID once more",
    createFirst: "First tap “Create my passkey”, then Post.",
    networkFailed: "That didn't go through (connection?). Try again.",
    usingPasskey: (label: string) => `Using your ${label}.`,
    passkeyCancelled: "Passkey cancelled. Nothing was posted.",
    passkeyFailed: "Your device couldn't sign with a passkey. Try again, or use a wallet.",
    noPasskey: "This browser has no passkeys. Use a wallet, or reply from a Farcaster app.",
    relayNote: "Published on Farcaster by the MesaSays account, with your name and signature.",
    dryRun: "Dry run: this Farcaster message was built and checked, and not sent.",
    tooLong: (n: number) => `${n} characters too long for one Farcaster post.`,
    onFarcaster: "on Farcaster",
    relayed: "via MesaSays",
    migrated: (date: string) => `from the old Say, ${date}`,
    replyOnFarcaster: "Reply on Farcaster",
    topicHint: "Farcaster users: post to this topic URL from any client that supports it.",
  },
  es: {
    peopleSay: "La gente dice",
    replies: (n: number) => (n ? `${n} ${n === 1 ? "respuesta" : "respuestas"}` : "sin respuesta aún"),
    sayingAs: (name: string) => `Publicas como ${name}`,
    pickName: "Elige un nombre (no hace falta el real)",
    cancel: "Cancelar",
    post: "Publicar",
    posting: "Publicando…",
    seeAll: (n: number) => `Ver las ${n}`,
    nobody: "Nadie ha dicho nada todavía. ¿Ya fuiste? Di qué pedir y qué evitar.",
    askAbout: (name: string) => `Pregunta o di algo sobre ${name}…`,
    license: "Lo que escribes es público y se comparte bajo CC BY-SA 4.0: cualquiera puede reutilizarlo citando tu nombre.",
    sign: "Firmar con tu wallet",
    signNote: "gratis, sin transacción",
    noWallet: "Instala una wallet como Rabby para firmar.",
    signing: "Revisa tu wallet…",
    signCancelled: "Firma cancelada. No se publicó nada.",
    signFailed: "Tu wallet no pudo firmar. Inténtalo otra vez o publica sin firmar.",
    signed: "firmado",
    notSigned: "sin firma",
    invalid: "firma inválida",
    team: "equipo MesaSays",
    signWith: "Firmar con",
    passkey: "Passkey",
    passkeyNote: "Face ID, huella o tu teléfono. Sin frase semilla.",
    walletOpt: "Wallet de Ethereum",
    noSign: "Sin firma",
    newPasskey: "La primera vez se crea una passkey de MesaSays en tu dispositivo.",
    havePasskey: "Ya tengo una",
    createPasskeyBtn: "Crear mi passkey (Face ID)",
    confirmPasskey: "Confirma con Face ID otra vez",
    createFirst: "Primero toca «Crear mi passkey» y luego Publicar.",
    networkFailed: "No se envió (¿conexión?). Inténtalo otra vez.",
    usingPasskey: (label: string) => `Usas tu ${label}.`,
    passkeyCancelled: "Passkey cancelada. No se publicó nada.",
    passkeyFailed: "Tu dispositivo no pudo firmar con passkey. Inténtalo otra vez o usa una wallet.",
    noPasskey: "Este navegador no tiene passkeys. Usa una wallet o responde desde una app de Farcaster.",
    relayNote: "La cuenta de MesaSays lo publica en Farcaster, con tu nombre y tu firma.",
    dryRun: "Prueba: este mensaje de Farcaster se armó y se verificó, pero no se envió.",
    tooLong: (n: number) => `${n} caracteres de más para un post de Farcaster.`,
    onFarcaster: "en Farcaster",
    relayed: "vía MesaSays",
    migrated: (date: string) => `del Say anterior, ${date}`,
    replyOnFarcaster: "Responder en Farcaster",
    topicHint: "Usuarios de Farcaster: publiquen en esta URL de tema desde un cliente que lo permita.",
  },
};

export const restaurantPath = (slug: string) => `/restaurants/${slug}`;
export const threadPath = (id: string) => `/say/${id}`;

const byActivity = (a: SayThreadData, b: SayThreadData) => lastActivity(b).localeCompare(lastActivity(a));

function Ago({ iso }: { iso: string }) {
  // Relative time can differ by a minute between server and browser; the browser's wins.
  return <time dateTime={iso} suppressHydrationWarning>{timeAgo(iso)}</time>;
}

/* ---------- shared pieces ---------- */

function ThreadCard({ thread, places, here, lang = "en" }: { thread: SayThreadData; places: Map<string, SayPlace>; here?: string; lang?: Lang }) {
  const linked = thread.slugs.filter((slug) => slug !== here).map((slug) => places.get(slug)).filter((place): place is SayPlace => Boolean(place));
  const replies = thread.replies.length;
  return (
    <article className="say-card">
      <h3 className="say-card-title">
        <Link href={threadPath(thread.id) as never}>{thread.title}</Link>
      </h3>
      <p className="say-meta">
        {thread.author} · <ProofBadge proof={thread.proof} source={thread.source} lang={lang} /> · {COPY[lang].replies(replies)} · <Ago iso={lastActivity(thread)} />
        {linked.map((place) => (
          <span key={place.slug}> · <Link href={restaurantPath(place.slug) as never} className="say-chip">{place.name}</Link></span>
        ))}
      </p>
    </article>
  );
}

/* ---------- signatures ---------- */

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

function wallet(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { ethereum?: Eip1193 }).ethereum ?? null);
}

function subscribeWallet(callback: () => void) {
  // Some wallets inject window.ethereum a moment after the page loads.
  window.addEventListener("ethereum#initialized", callback);
  const timer = window.setTimeout(callback, 1000);
  return () => {
    window.removeEventListener("ethereum#initialized", callback);
    window.clearTimeout(timer);
  };
}

/** False on the server and when no wallet is installed: the form then shows a hint instead. */
const useHasWallet = () => useSyncExternalStore(subscribeWallet, () => Boolean(wallet()), () => false);

class SignError extends Error {
  constructor(readonly cancelled: boolean) {
    super(cancelled ? "cancelled" : "failed");
  }
}

/** Asks the wallet for an account, then for an EIP-712 signature of exactly this note. */
async function signNote(note: Note): Promise<SignedInput> {
  const provider = wallet();
  if (!provider) throw new SignError(false);
  try {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    const signer = accounts?.[0];
    if (!signer) throw new SignError(false);
    const signature = (await provider.request({ method: "eth_signTypedData_v4", params: [signer, JSON.stringify(notePayload(note))] })) as string;
    return { signer, signature, createdAt: note.createdAt };
  } catch (error) {
    if (error instanceof SignError) throw error;
    // 4001 = the person said no (EIP-1193); some wallets only say so in the message.
    const { code, message } = (error ?? {}) as { code?: number; message?: string };
    throw new SignError(code === 4001 || /reject|denied|cancel/i.test(message ?? ""));
  }
}

function SignField({ sign, setSign, lang = "en" }: { sign: boolean; setSign: (value: boolean) => void; lang?: Lang }) {
  const c = COPY[lang];
  if (!useHasWallet()) return <p className="say-meta say-sign-hint">{c.noWallet}</p>;
  return (
    <label className="say-sign say-meta">
      <input type="checkbox" checked={sign} onChange={(event) => setSign(event.target.checked)} />
      <span>{c.sign} <span className="say-dim">· {c.signNote}</span></span>
    </label>
  );
}

type Method = "passkey" | "wallet" | "none";

const subscribeNothing = () => () => undefined;
const usePasskeysSupported = () => useSyncExternalStore(subscribeNothing, passkeysSupported, () => false);

/** Farcaster mode: passkey first (no crypto needed), a wallet for those who have one. */
function MethodField({ method, setMethod, mode, identity, setIdentity, author, lang = "en" }: { method: Method; setMethod: (value: Method) => void; mode: SayMode; identity: PasskeyIdentity | null; setIdentity: (value: PasskeyIdentity | null) => void; author: string; lang?: Lang }) {
  const c = COPY[lang];
  const hasWallet = useHasWallet();
  const hasPasskeys = usePasskeysSupported();
  const [finding, setFinding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // "I already have one" takes two passkey prompts; Safari allows one per tap, so the second is its own button.
  const [firstStep, setFirstStep] = useState<PasskeyFirstStep | null>(null);
  // No passkeys on this device but a wallet: show the wallet as chosen (submit does the same).
  const shown: Method = method === "passkey" && !hasPasskeys && hasWallet ? "wallet" : method;
  const tap = async (step: () => Promise<void>) => {
    setFinding(true);
    setProblem(null);
    try {
      await step();
    } catch (error) {
      if (!(error instanceof PasskeyError && error.cancelled)) setProblem(error instanceof Error && error.message !== "failed" ? error.message : c.passkeyFailed);
    }
    setFinding(false);
  };
  const options: Array<[Method, string, boolean]> = [
    ["passkey", c.passkey, hasPasskeys],
    ["wallet", c.walletOpt, hasWallet],
    ["none", c.noSign, mode.allowUnsigned],
  ];
  return (
    <fieldset className="say-methods">
      <legend className="say-meta">{c.signWith}</legend>
      {options.filter(([, , available]) => available).map(([value, label]) => (
        <label key={value} className="say-sign say-meta">
          <input type="radio" name="say-method" checked={shown === value} onChange={() => setMethod(value)} />
          <span>{label}</span>
        </label>
      ))}
      {shown === "passkey" ? (
        <div className="say-meta say-dim">
          <p>
            {c.passkeyNote} {identity ? c.usingPasskey(passkeyLabel(identity)) : c.newPasskey}
          </p>
          {identity ? null : firstStep ? (
            <p>
              <button type="button" className="say-primary" disabled={finding} onClick={() => tap(async () => {
                setIdentity(await findPasskeyFinish(firstStep));
                setFirstStep(null);
              })}>
                {c.confirmPasskey}
              </button>
            </p>
          ) : (
            <p className="say-row">
              <button type="button" className="say-primary" disabled={finding} onClick={() => tap(async () => setIdentity(await createPasskey(author)))}>
                {c.createPasskeyBtn}
              </button>
              <button type="button" className="say-textbtn" disabled={finding} onClick={() => tap(async () => setFirstStep(await findPasskeyStart()))}>
                {c.havePasskey}
              </button>
            </p>
          )}
        </div>
      ) : null}
      {!hasPasskeys && !hasWallet ? <p className="say-meta say-sign-hint">{c.noPasskey}</p> : null}
      {problem ? <p className="say-error">{problem}</p> : null}
      <p className="say-meta say-dim">{c.relayNote}</p>
    </fieldset>
  );
}

function ProofBadge({ proof, source, lang = "en" }: { proof: SayProof | null; source?: SaySource; lang?: Lang }) {
  const c = COPY[lang];
  // A Farcaster user's own cast: their account signed it (Ed25519), checked by every hub.
  if (source?.kind === "farcaster") return <span className="say-badge">{c.onFarcaster}</span>;
  if (source?.kind === "team") return <span className="say-badge">{c.team} · {c.onFarcaster}</span>;
  if (source?.kind === "migrated") return <span className="say-dim">{c.migrated(source.date)}{source.signer ? ` · ${c.signed} ${source.signer}` : ""}</span>;
  const via = source?.kind === "relayed" ? ` · ${c.relayed}` : "";
  if (!proof) return <span className="say-dim">{c.notSigned}{via}</span>;
  if (proof.status === "invalid") return <span className="say-badge is-invalid">{c.invalid}{via}</span>;
  if (proof.method === "passkey") return <span className="say-badge" title={proof.signer}>{c.signed} · passkey {proof.signer.slice(0, 8)}{via}</span>;
  const known = knownSigner(proof.signer);
  return (
    <span className="say-badge" title={proof.signer}>
      {c.signed} · {known ? `${known.label}${known.team ? ` · ${c.team}` : ""}` : shortAddress(proof.signer)}{via}
    </span>
  );
}

/** Where to read or answer a cast without us: several clients, plus the raw message on a public hub. */
function FarcasterLinks({ cast, lang = "en" }: { cast?: SayCastRef; lang?: Lang }) {
  const [copied, setCopied] = useState(false);
  if (!cast) return null;
  const key = castKey(cast.fid, cast.hash);
  return (
    <p className="say-meta say-fc">
      {COPY[lang].replyOnFarcaster}:{" "}
      <a href={`https://farcaster.xyz/~/conversations/${cast.hash}`} target="_blank" rel="noreferrer">farcaster.xyz</a> ·{" "}
      <a href={`https://quilcast.com/c/${cast.hash}`} target="_blank" rel="noreferrer">quilcast</a> ·{" "}
      <a href={`https://haatz.quilibrium.com/v1/castById?fid=${cast.fid}&hash=${cast.hash}`} target="_blank" rel="noreferrer">raw</a> ·{" "}
      <button type="button" className="say-textbtn" onClick={() => navigator.clipboard?.writeText(key).then(() => setCopied(true), () => undefined)}>
        {copied ? "copied" : `cast ${cast.hash.slice(0, 10)}`}
      </button>
    </p>
  );
}

function Verify({ proof }: { proof: SayProof | null }) {
  const [copied, setCopied] = useState(false);
  if (!proof) return null;
  const json = JSON.stringify(proof.payload, null, 2);
  const known = proof.status === "valid" ? knownSigner(proof.signer) : null;
  return (
    <details className="say-verify">
      <summary className="say-meta">Verify</summary>
      <div className="say-verify-body">
        {proof.status === "valid" && proof.method === "passkey" ? (
          <p className="say-meta">
            This exact text was signed with a passkey (WebAuthn, P-256) whose id is below: the id is the start of the
            sha256 of its public key. The challenge it signed is the EIP-712 hash of the JSON below. A passkey proves
            the same device or password manager signed, not who the person is.
          </p>
        ) : proof.status === "valid" ? (
          <p className="say-meta">
            This exact text was signed by the Ethereum address below (EIP-712, checked by our server on every view).
            {known ? ` We know this address: ${known.label}${known.team ? ", MesaSays team" : ""}.` : " A signature proves an address, not a name: anyone can type any name."}
          </p>
        ) : (
          <p className="say-meta say-error">This post claims a signature that does not match its text or signer. Do not trust it.</p>
        )}
        <p className="say-meta"><span className="say-dim">{proof.method === "passkey" ? "Passkey id" : "Signer"}</span><br /><code>{proof.signer}</code></p>
        <p className="say-meta"><span className="say-dim">Signature{proof.method === "passkey" ? " (r || s, base64url)" : ""}</span><br /><code>{proof.signature}</code></p>
        {proof.status === "valid" && proof.passkey ? (
          <>
            <p className="say-meta"><span className="say-dim">Public key (P-256, uncompressed, base64url)</span><br /><code>{proof.passkey.publicKey}</code></p>
            <p className="say-meta"><span className="say-dim">authenticatorData</span><br /><code>{proof.passkey.authenticatorData}</code></p>
            <p className="say-meta"><span className="say-dim">clientDataJSON</span><br /><code>{proof.passkey.clientDataJSON}</code></p>
          </>
        ) : null}
        <p className="say-meta">
          <span className="say-dim">Signed JSON (eth_signTypedData_v4)</span>{" "}
          <button
            type="button"
            className="say-textbtn"
            onClick={() => navigator.clipboard?.writeText(json).then(() => setCopied(true), () => undefined)}
          >
            {copied ? "copied" : "copy"}
          </button>
        </p>
        <pre className="say-json">{json}</pre>
        <p className="say-meta say-dim">
          {proof.method === "passkey"
            ? "Check it yourself: docs/SAY_FARCASTER.md in our public code, or node scripts/verify-cast.mjs <fid>-<hash>."
            : "Check it yourself with viem or ethers verifyTypedData, or any EIP-712 tool."}
        </p>
      </div>
    </details>
  );
}

function LicenseNote({ lang = "en" }: { lang?: Lang }) {
  return (
    <p className="say-meta">
      <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">{COPY[lang].license}</a>
    </p>
  );
}

function NameField({ draft, setDraft, lang = "en" }: { draft: string; setDraft: (value: string) => void; lang?: Lang }) {
  const { name } = useSayName();
  if (name) return <p className="say-meta">{COPY[lang].sayingAs(name)}</p>;
  return (
    <label className="say-field">
      <span className="say-meta">{COPY[lang].pickName}</span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^\p{L}\p{N}_.]/gu, "").slice(0, 20))}
        placeholder="taco_hunter"
        autoComplete="off"
        required
      />
    </label>
  );
}

type Send = (author: string, text: string, website: string, signed: SignedInput | null) => Promise<SayResult>;

/** Text box + name + optional signature + send, shared by new conversations and replies. */
function useSend(send: Send, note: (author: string, text: string, createdAt: number) => Note, mode: SayMode, lang: Lang = "en") {
  const { name, setName } = useSayName();
  const [draft, setDraft] = useState("");
  const [text, setText] = useState("");
  const [website, setWebsite] = useState("");
  const [sign, setSign] = useState(false);
  const [method, setMethod] = useState<Method>(mode.backend === "farcaster" ? "passkey" : "none");
  // Kept in this browser once a passkey is made or found (components/say/passkey-client.ts).
  const remembered = usePasskeyIdentity();
  const [found, setIdentity] = useState<PasskeyIdentity | null>(null);
  const identity = found ?? remembered;
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<SayDryRun | null>(null);
  const [busy, setBusy] = useState<false | "signing" | "sending">(false);
  const author = name ?? draft;
  const c = COPY[lang];

  // Database backends: the old checkbox. Farcaster: the chosen method.
  const picked: Method = mode.backend === "farcaster" ? method : sign ? "wallet" : "none";
  const over = mode.maxBytes ? Math.max(0, byteLength(text.trim()) - mode.maxBytes) : 0;

  async function submit(event: FormEvent, after: (id: string) => void) {
    event.preventDefault();
    if (busy || !author || over) return;
    setError(null);
    setDryRun(null);
    let signed: SignedInput | null = null;
    // Same rule as the method field: no passkeys here but a wallet means the wallet.
    const chosen: Method = picked === "passkey" && !passkeysSupported() && wallet() ? "wallet" : picked;
    // The signer signs the exact fields the server will check (same normalisation on both sides).
    const current = () => note(author, text, Math.floor(Date.now() / 1000));
    if (chosen === "wallet" && wallet()) {
      setBusy("signing");
      try {
        signed = await signNote(current());
      } catch (problem) {
        setBusy(false);
        return setError(problem instanceof SignError && problem.cancelled ? c.signCancelled : c.signFailed);
      }
    }
    if (chosen === "passkey") {
      setBusy("signing");
      try {
        // One passkey prompt per tap on Safari: creating the passkey is its own button, Post only signs.
        if (!identity) {
          setBusy(false);
          return setError(c.createFirst);
        }
        signed = await signNoteWithPasskey(current(), identity);
      } catch (problem) {
        setBusy(false);
        if (problem instanceof PasskeyError && problem.cancelled) return setError(c.passkeyCancelled);
        return setError(problem instanceof Error && problem.message !== "failed" ? problem.message : c.passkeyFailed);
      }
    }
    setBusy("sending");
    let result: SayResult;
    try {
      result = await send(author, text, website, signed);
    } catch {
      // A dropped connection or a server error: never leave the button stuck on "Sending…".
      setBusy(false);
      return setError(c.networkFailed);
    }
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (!name) setName(author);
    if (result.dryRun) return setDryRun(result.dryRun);
    setText("");
    after(result.id);
  }

  return { draft, setDraft, text, setText, website, setWebsite, sign, setSign, method, setMethod, identity, setIdentity, error, dryRun, busy, author, over, submit };
}

type Form = ReturnType<typeof useSend>;

/** The signing part of a form, per backend. */
function Signing({ form, mode, lang = "en" }: { form: Form; mode: SayMode; lang?: Lang }) {
  if (mode.backend !== "farcaster") return <SignField sign={form.sign} setSign={form.setSign} lang={lang} />;
  return <MethodField method={form.method} setMethod={form.setMethod} mode={mode} identity={form.identity} setIdentity={form.setIdentity} author={form.author} lang={lang} />;
}

/** Errors, length warning and the dry-run result under a form. */
function FormStatus({ form, lang = "en" }: { form: Form; lang?: Lang }) {
  const c = COPY[lang];
  return (
    <>
      {form.over ? <p className="say-error" role="alert">{c.tooLong(form.over)}</p> : null}
      {form.error ? <p className="say-error" role="alert">{form.error}</p> : null}
      {form.dryRun ? (
        <details className="say-verify" open>
          <summary className="say-meta">{c.dryRun}</summary>
          <div className="say-verify-body">
            <p className="say-meta">
              <span className="say-dim">Cast</span> <code>{form.dryRun.hash}</code> · fid {form.dryRun.fid} · {form.dryRun.type} · {form.dryRun.bytes} bytes · {form.dryRun.hub}
            </p>
            <p className="say-meta"><span className="say-dim">Under</span> <code>{form.dryRun.parent}</code></p>
            <pre className="say-json">{form.dryRun.text}</pre>
            {form.dryRun.embeds.map((url) => <p key={url} className="say-meta"><code>{url}</code></p>)}
            <pre className="say-json">{JSON.stringify(form.dryRun.json, null, 2)}</pre>
          </div>
        </details>
      ) : null}
    </>
  );
}

/** Invisible to people, tempting to bots. */
function Honeypot({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input className="say-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={value} onChange={(event) => onChange(event.target.value)} />
  );
}

function Composer({ slug, placeholder, mode, lang = "en" }: { slug?: string; placeholder: string; mode: SayMode; lang?: Lang }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useSend(
    (author, text, website, signed) => postThread({ author, text, slug: slug ?? null, website, signed }),
    (author, text, createdAt) => threadNote({ author, text, place: slug ?? null, createdAt }),
    mode,
    lang,
  );
  const ready = form.text.trim().length >= 8 && Boolean(form.author) && !form.busy && !form.over && mode.relay !== "off";

  if (!open) {
    return (
      <button type="button" className="say-composer-closed" onClick={() => setOpen(true)}>
        {placeholder}
      </button>
    );
  }

  return (
    <form className="say-composer" onSubmit={(event) => form.submit(event, (id) => router.push(threadPath(id) as never))}>
      <textarea value={form.text} onChange={(event) => form.setText(event.target.value)} placeholder={placeholder} rows={4} maxLength={4000} autoFocus />
      <NameField draft={form.draft} setDraft={form.setDraft} lang={lang} />
      <Signing form={form} mode={mode} lang={lang} />
      <Honeypot value={form.website} onChange={form.setWebsite} />
      <LicenseNote lang={lang} />
      <FormStatus form={form} lang={lang} />
      <div className="say-row">
        <button type="button" className="say-textbtn" onClick={() => setOpen(false)}>{COPY[lang].cancel}</button>
        <button type="submit" className="say-primary" disabled={!ready}>{form.busy === "signing" ? COPY[lang].signing : form.busy ? COPY[lang].posting : COPY[lang].post}</button>
      </div>
    </form>
  );
}

/* ---------- restaurant page block ---------- */

export function SayBlock({ place, lang = "en" }: { place: SayPlace; lang?: Lang }) {
  const c = COPY[lang];
  const [threads, setThreads] = useState<SayThreadData[] | null>(null);
  const [places, setPlaces] = useState<SayPlace[]>([]);
  const [mode, setMode] = useState<SayMode>(DATABASE_MODE);
  const [all, setAll] = useState(false);
  const bySlug = useMemo(() => new Map(places.map((item) => [item.slug, item])), [places]);

  // Restaurant pages are static; their conversations (and the names of linked places) load once the page is open.
  useEffect(() => {
    let live = true;
    fetch(`/say/threads?slug=${encodeURIComponent(place.slug)}`)
      .then((response) => response.json())
      .then((data: { threads: SayThreadData[]; places: SayPlace[]; mode?: SayMode }) => {
        if (!live) return;
        setThreads(data.threads ?? []);
        setPlaces(data.places ?? []);
        if (data.mode) setMode(data.mode);
      })
      .catch(() => live && setThreads([]));
    return () => {
      live = false;
    };
  }, [place.slug]);

  const mine = (threads ?? []).toSorted(byActivity);
  const shown = all ? mine : mine.slice(0, 3);
  return (
    <section className="say say-block" aria-labelledby="say-title" id="say">
      <div className="say-head">
        <h2 id="say-title">{c.peopleSay}</h2>
        <span className="ms-label ms-num">{threads ? mine.length : ""}</span>
      </div>
      {shown.map((thread) => <ThreadCard key={thread.id} thread={thread} places={bySlug} here={place.slug} lang={lang} />)}
      {mine.length > shown.length ? (
        <button type="button" className="say-textbtn say-more" onClick={() => setAll(true)}>{c.seeAll(mine.length)}</button>
      ) : null}
      {threads && !mine.length ? <p className="say-empty">{c.nobody}</p> : null}
      <Composer slug={place.slug} placeholder={c.askAbout(place.name)} mode={mode} lang={lang} />
      {mode.backend === "farcaster" ? <p className="say-meta say-dim say-topic">{c.topicHint} <code>{topicUrl(place.slug)}</code></p> : null}
    </section>
  );
}

/* ---------- /say: every conversation, liveliest first ---------- */

export function SayFeed({ threads, places, mode = DATABASE_MODE }: { threads: SayThreadData[]; places: SayPlace[]; mode?: SayMode }) {
  const [area, setArea] = useState("");
  const bySlug = useMemo(() => new Map(places.map((place) => [place.slug, place])), [places]);
  const areasOf = (slugs: string[]) => slugs.map((slug) => bySlug.get(slug)?.neighborhood).filter((value): value is string => Boolean(value));
  const areas = [...new Set(threads.flatMap((thread) => areasOf(thread.slugs)))].sort();
  const list = threads.filter((thread) => !area || areasOf(thread.slugs).includes(area)).toSorted(byActivity);

  return (
    <div className="say">
      <Composer placeholder="Ask or say something about a restaurant…" mode={mode} />
      {mode.backend === "farcaster" ? <p className="say-meta say-dim say-topic">{COPY.en.topicHint} <code>{topicUrl(null)}</code></p> : null}
      <div className="say-filters">
        <span className="ms-label">Latest</span>
        {areas.length ? (
          <select value={area} onChange={(event) => setArea(event.target.value)} aria-label="Neighborhood">
            <option value="">All of CDMX</option>
            {areas.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        ) : null}
      </div>
      {list.map((thread) => <ThreadCard key={thread.id} thread={thread} places={bySlug} />)}
      {!threads.length ? <p className="say-empty">Nothing yet. Start the first conversation.</p> : null}
    </div>
  );
}

/* ---------- thread page ---------- */

function ReplyBox({ threadId, parentId, onDone, autoFocus, mode }: { threadId: string; parentId: string | null; onDone?: () => void; autoFocus?: boolean; mode: SayMode }) {
  const router = useRouter();
  const form = useSend(
    (author, body, website, signed) => postReply({ threadId, parentId, author, body, website, signed }),
    (author, text, createdAt) => replyNote({ author, text, threadId, parentId, createdAt }),
    mode,
  );
  const ready = form.text.trim().length >= 2 && Boolean(form.author) && !form.busy && !form.over && mode.relay !== "off";
  return (
    <form
      className="say-composer say-reply"
      onSubmit={(event) =>
        form.submit(event, () => {
          onDone?.();
          router.refresh();
        })
      }
    >
      <textarea value={form.text} onChange={(event) => form.setText(event.target.value)} placeholder={parentId ? "Reply…" : "Been there? Say what to order, and what to skip."} rows={2} maxLength={4000} autoFocus={autoFocus} />
      <NameField draft={form.draft} setDraft={form.setDraft} />
      <Signing form={form} mode={mode} />
      <Honeypot value={form.website} onChange={form.setWebsite} />
      <LicenseNote />
      <FormStatus form={form} />
      <div className="say-row">
        {onDone ? <button type="button" className="say-textbtn" onClick={onDone}>Cancel</button> : <span />}
        <button type="submit" className="say-primary" disabled={!ready}>{form.busy === "signing" ? COPY.en.signing : form.busy ? "Sending…" : "Reply"}</button>
      </div>
    </form>
  );
}

type TreeProps = { replies: SayReply[]; threadId: string; depth: number; mode: SayMode };

function ReplyTree({ parentId, ...props }: TreeProps & { parentId: string | null }) {
  // Oldest first: a conversation reads top to bottom.
  const children = props.replies.filter((reply) => reply.parentId === parentId);
  if (!children.length) return null;
  return (
    <ul className={props.depth ? "say-comments is-nested" : "say-comments"}>
      {children.map((reply) => <ReplyItem key={reply.id} reply={reply} {...props} />)}
    </ul>
  );
}

function ReplyItem({ reply, ...props }: TreeProps & { reply: SayReply }) {
  const [replying, setReplying] = useState(false);
  return (
    <li className="say-comment">
      <p className="say-meta">{reply.author} · <ProofBadge proof={reply.proof} source={reply.source} /> · <Ago iso={reply.createdAt} /></p>
      <p className="say-text">{reply.body}</p>
      <Verify proof={reply.proof} />
      <FarcasterLinks cast={reply.cast} />
      {props.depth < 3 ? (
        <button type="button" className="say-textbtn" onClick={() => setReplying((value) => !value)}>Reply</button>
      ) : null}
      {replying ? <ReplyBox threadId={props.threadId} parentId={reply.id} onDone={() => setReplying(false)} autoFocus mode={props.mode} /> : null}
      <ReplyTree {...props} parentId={reply.id} depth={props.depth + 1} />
    </li>
  );
}

export function SayThread({ thread, places, mode = DATABASE_MODE }: { thread: SayThreadData; places: SayPlace[]; mode?: SayMode }) {
  return (
    <div className="say">
      <nav className="say-meta say-crumb" aria-label="Breadcrumb">
        <Link href={"/say" as never} className="say-chip">Say</Link>
        {places.map((place) => (
          <span key={place.slug}> · <Link href={restaurantPath(place.slug) as never} className="say-chip">{place.name}</Link></span>
        ))}
      </nav>
      <article className="say-op">
        <p className="say-meta">{thread.author} · <ProofBadge proof={thread.proof} source={thread.source} /> · <Ago iso={thread.createdAt} /></p>
        <h1 className="say-op-title">{thread.title}</h1>
        {thread.body ? <p className="say-text">{thread.body}</p> : null}
        <Verify proof={thread.proof} />
        <FarcasterLinks cast={thread.cast} />
      </article>

      <ReplyBox threadId={thread.id} parentId={null} mode={mode} />
      <p className="ms-label say-count">{thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}</p>
      <ReplyTree replies={thread.replies} parentId={null} threadId={thread.id} depth={0} mode={mode} />
    </div>
  );
}
