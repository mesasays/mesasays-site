"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { postReply, postThread } from "@/app/say/actions";
import { lastActivity, timeAgo, useSayName } from "@/components/say/store";
import type { SayReply, SayThreadData } from "@/lib/say/db";
import "./say.css";

// "Say": people ask and tell each other what to order. No accounts, no votes: a name and you post.

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
        {thread.author} · {COPY[lang].replies(replies)} · <Ago iso={lastActivity(thread)} />
        {linked.map((place) => (
          <span key={place.slug}> · <Link href={restaurantPath(place.slug) as never} className="say-chip">{place.name}</Link></span>
        ))}
      </p>
    </article>
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

/** Text box + name + send, shared by new conversations and replies. */
function useSend(send: (author: string, text: string, website: string) => Promise<{ ok: true; id: string } | { ok: false; error: string }>) {
  const { name, setName } = useSayName();
  const [draft, setDraft] = useState("");
  const [text, setText] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const author = name ?? draft;

  async function submit(event: FormEvent, after: (id: string) => void) {
    event.preventDefault();
    if (busy || !author) return;
    setBusy(true);
    setError(null);
    const result = await send(author, text, website);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (!name) setName(author);
    setText("");
    after(result.id);
  }

  return { draft, setDraft, text, setText, website, setWebsite, error, busy, author, submit };
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
  const form = useSend((author, text, website) => postThread({ author, text, slug: slug ?? null, website }));
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
      <Honeypot value={form.website} onChange={form.setWebsite} />
      {form.error ? <p className="say-error" role="alert">{form.error}</p> : null}
      <div className="say-row">
        <button type="button" className="say-textbtn" onClick={() => setOpen(false)}>{COPY[lang].cancel}</button>
        <button type="submit" className="say-primary" disabled={!ready}>{form.busy ? COPY[lang].posting : COPY[lang].post}</button>
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
        <span className="ds-label num">{threads ? mine.length : ""}</span>
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
        <span className="ds-label">Latest</span>
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
  const form = useSend((author, body, website) => postReply({ threadId, parentId, author, body, website }));
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
      <Honeypot value={form.website} onChange={form.setWebsite} />
      {form.error ? <p className="say-error" role="alert">{form.error}</p> : null}
      <div className="say-row">
        {onDone ? <button type="button" className="say-textbtn" onClick={onDone}>Cancel</button> : <span />}
        <button type="submit" className="say-primary" disabled={!ready}>{form.busy ? "Sending…" : "Reply"}</button>
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
      <p className="say-meta">{reply.author} · <Ago iso={reply.createdAt} /></p>
      <p className="say-text">{reply.body}</p>
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
        <p className="say-meta">{thread.author} · <Ago iso={thread.createdAt} /></p>
        <h1 className="say-op-title">{thread.title}</h1>
        {thread.body ? <p className="say-text">{thread.body}</p> : null}
      </article>

      <ReplyBox threadId={thread.id} parentId={null} />
      <p className="ds-label say-count">{thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}</p>
      <ReplyTree replies={thread.replies} parentId={null} threadId={thread.id} depth={0} />
    </div>
  );
}
