"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { postReply, postThread } from "@/app/say/actions";
import { lastActivity, timeAgo, useSayName } from "@/components/say/store";
import type { SayReply, SayThreadData } from "@/lib/say/db";
import { notePayload, replyNote, shortAddress, threadNote, type Note, type SayProof, type SignedInput } from "@/lib/say/signature";
import { knownSigner } from "@/lib/say/signers";
import "./say.css";

// "Say": people ask and tell each other what to order. No accounts, no votes: a name and you post.
// Optionally signed with an Ethereum wallet (EIP-712, free, no transaction): see docs/SIGNED_NOTES.md.

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
        {thread.author} · <ProofBadge proof={thread.proof} lang={lang} /> · {COPY[lang].replies(replies)} · <Ago iso={lastActivity(thread)} />
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

function ProofBadge({ proof, lang = "en" }: { proof: SayProof | null; lang?: Lang }) {
  const c = COPY[lang];
  if (!proof) return <span className="say-dim">{c.notSigned}</span>;
  if (proof.status === "invalid") return <span className="say-badge is-invalid">{c.invalid}</span>;
  const known = knownSigner(proof.signer);
  return (
    <span className="say-badge" title={proof.signer}>
      {c.signed} · {known ? `${known.label}${known.team ? ` · ${c.team}` : ""}` : shortAddress(proof.signer)}
    </span>
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
        {proof.status === "valid" ? (
          <p className="say-meta">
            This exact text was signed by the Ethereum address below (EIP-712, checked by our server on every view).
            {known ? ` We know this address: ${known.label}${known.team ? ", MesaSays team" : ""}.` : " A signature proves an address, not a name: anyone can type any name."}
          </p>
        ) : (
          <p className="say-meta say-error">This post claims a signature that does not match its text or signer. Do not trust it.</p>
        )}
        <p className="say-meta"><span className="say-dim">Signer</span><br /><code>{proof.signer}</code></p>
        <p className="say-meta"><span className="say-dim">Signature</span><br /><code>{proof.signature}</code></p>
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
        <p className="say-meta say-dim">Check it yourself with viem or ethers verifyTypedData, or any EIP-712 tool.</p>
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

type Send = (author: string, text: string, website: string, signed: SignedInput | null) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;

/** Text box + name + optional signature + send, shared by new conversations and replies. */
function useSend(send: Send, note: (author: string, text: string, createdAt: number) => Note, lang: Lang = "en") {
  const { name, setName } = useSayName();
  const [draft, setDraft] = useState("");
  const [text, setText] = useState("");
  const [website, setWebsite] = useState("");
  const [sign, setSign] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<false | "signing" | "sending">(false);
  const author = name ?? draft;

  async function submit(event: FormEvent, after: (id: string) => void) {
    event.preventDefault();
    if (busy || !author) return;
    setError(null);
    let signed: SignedInput | null = null;
    if (sign && wallet()) {
      setBusy("signing");
      try {
        // The wallet signs the exact fields the server will store (same normalisation on both sides).
        signed = await signNote(note(author, text, Math.floor(Date.now() / 1000)));
      } catch (problem) {
        setBusy(false);
        return setError(problem instanceof SignError && problem.cancelled ? COPY[lang].signCancelled : COPY[lang].signFailed);
      }
    }
    setBusy("sending");
    const result = await send(author, text, website, signed);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (!name) setName(author);
    setText("");
    after(result.id);
  }

  return { draft, setDraft, text, setText, website, setWebsite, sign, setSign, error, busy, author, submit };
}

/** Invisible to people, tempting to bots. */
function Honeypot({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input className="say-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={value} onChange={(event) => onChange(event.target.value)} />
  );
}

function Composer({ slug, placeholder, lang = "en" }: { slug?: string; placeholder: string; lang?: Lang }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useSend(
    (author, text, website, signed) => postThread({ author, text, slug: slug ?? null, website, signed }),
    (author, text, createdAt) => threadNote({ author, text, place: slug ?? null, createdAt }),
    lang,
  );
  const ready = form.text.trim().length >= 8 && Boolean(form.author) && !form.busy;

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
      <SignField sign={form.sign} setSign={form.setSign} lang={lang} />
      <Honeypot value={form.website} onChange={form.setWebsite} />
      <LicenseNote lang={lang} />
      {form.error ? <p className="say-error" role="alert">{form.error}</p> : null}
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
  const [all, setAll] = useState(false);
  const bySlug = useMemo(() => new Map(places.map((item) => [item.slug, item])), [places]);

  // Restaurant pages are static; their conversations (and the names of linked places) load once the page is open.
  useEffect(() => {
    let live = true;
    fetch(`/say/threads?slug=${encodeURIComponent(place.slug)}`)
      .then((response) => response.json())
      .then((data: { threads: SayThreadData[]; places: SayPlace[] }) => {
        if (!live) return;
        setThreads(data.threads ?? []);
        setPlaces(data.places ?? []);
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
      <Composer slug={place.slug} placeholder={c.askAbout(place.name)} lang={lang} />
    </section>
  );
}

/* ---------- /say: every conversation, liveliest first ---------- */

export function SayFeed({ threads, places }: { threads: SayThreadData[]; places: SayPlace[] }) {
  const [area, setArea] = useState("");
  const bySlug = useMemo(() => new Map(places.map((place) => [place.slug, place])), [places]);
  const areasOf = (slugs: string[]) => slugs.map((slug) => bySlug.get(slug)?.neighborhood).filter((value): value is string => Boolean(value));
  const areas = [...new Set(threads.flatMap((thread) => areasOf(thread.slugs)))].sort();
  const list = threads.filter((thread) => !area || areasOf(thread.slugs).includes(area)).toSorted(byActivity);

  return (
    <div className="say">
      <Composer placeholder="Ask or say something about a restaurant…" />
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

function ReplyBox({ threadId, parentId, onDone, autoFocus }: { threadId: string; parentId: string | null; onDone?: () => void; autoFocus?: boolean }) {
  const router = useRouter();
  const form = useSend(
    (author, body, website, signed) => postReply({ threadId, parentId, author, body, website, signed }),
    (author, text, createdAt) => replyNote({ author, text, threadId, parentId, createdAt }),
  );
  const ready = form.text.trim().length >= 2 && Boolean(form.author) && !form.busy;
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
      <SignField sign={form.sign} setSign={form.setSign} />
      <Honeypot value={form.website} onChange={form.setWebsite} />
      <LicenseNote />
      {form.error ? <p className="say-error" role="alert">{form.error}</p> : null}
      <div className="say-row">
        {onDone ? <button type="button" className="say-textbtn" onClick={onDone}>Cancel</button> : <span />}
        <button type="submit" className="say-primary" disabled={!ready}>{form.busy === "signing" ? COPY.en.signing : form.busy ? "Sending…" : "Reply"}</button>
      </div>
    </form>
  );
}

type TreeProps = { replies: SayReply[]; threadId: string; depth: number };

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
      <p className="say-meta">{reply.author} · <ProofBadge proof={reply.proof} /> · <Ago iso={reply.createdAt} /></p>
      <p className="say-text">{reply.body}</p>
      <Verify proof={reply.proof} />
      {props.depth < 3 ? (
        <button type="button" className="say-textbtn" onClick={() => setReplying((value) => !value)}>Reply</button>
      ) : null}
      {replying ? <ReplyBox threadId={props.threadId} parentId={reply.id} onDone={() => setReplying(false)} autoFocus /> : null}
      <ReplyTree {...props} parentId={reply.id} depth={props.depth + 1} />
    </li>
  );
}

export function SayThread({ thread, places }: { thread: SayThreadData; places: SayPlace[] }) {
  return (
    <div className="say">
      <nav className="say-meta say-crumb" aria-label="Breadcrumb">
        <Link href={"/say" as never} className="say-chip">Say</Link>
        {places.map((place) => (
          <span key={place.slug}> · <Link href={restaurantPath(place.slug) as never} className="say-chip">{place.name}</Link></span>
        ))}
      </nav>
      <article className="say-op">
        <p className="say-meta">{thread.author} · <ProofBadge proof={thread.proof} /> · <Ago iso={thread.createdAt} /></p>
        <h1 className="say-op-title">{thread.title}</h1>
        {thread.body ? <p className="say-text">{thread.body}</p> : null}
        <Verify proof={thread.proof} />
      </article>

      <ReplyBox threadId={thread.id} parentId={null} />
      <p className="ms-label say-count">{thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}</p>
      <ReplyTree replies={thread.replies} parentId={null} threadId={thread.id} depth={0} />
    </div>
  );
}
