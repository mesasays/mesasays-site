// Say in the static (IPFS / mesasays.eth) build. Conversations need a server, so the static copy
// of the guide points to the live ones instead. next.config.ts swaps this file in for
// "@/components/say/Say" when MESASAYS_TARGET=ipfs; the normal builds never load it.
import type { SayMode, SayThreadData } from "@/lib/say/types";
import "./say.css";

export type SayPlace = { slug: string; name: string; neighborhood: string | null };
type Lang = "en" | "es";

export const SAY_LIVE_URL = "https://mesasays.com/say";
export const restaurantPath = (slug: string) => `/restaurants/${slug}`;
export const threadPath = (id: string) => `/say/${id}`;

const COPY = {
  en: { title: "People say", text: "Conversations live at", tail: "This copy of the guide is static, so it cannot show them." },
  es: { title: "La gente dice", text: "Las conversaciones están en", tail: "Esta copia de la guía es estática y no puede mostrarlas." },
};

export function SayNotice({ lang = "en" }: { lang?: Lang }) {
  const c = COPY[lang];
  return (
    <section className="say say-block" aria-labelledby="say-title" id="say">
      <div className="say-head">
        <h2 id="say-title">{c.title}</h2>
      </div>
      <p className="say-empty">
        {c.text} <a href={SAY_LIVE_URL}>{SAY_LIVE_URL}</a>. {c.tail}
      </p>
    </section>
  );
}

export function SayBlock({ lang = "en" }: { place: SayPlace; lang?: Lang }) {
  return <SayNotice lang={lang} />;
}

// Same props as the live components, so the swap is invisible to their callers.
export function SayFeed(props: { threads: SayThreadData[]; places: SayPlace[]; mode?: SayMode }) {
  void props;
  return <SayNotice />;
}

export function SayThread(props: { thread: SayThreadData; places: SayPlace[]; mode?: SayMode }) {
  void props;
  return <SayNotice />;
}
