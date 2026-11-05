import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { FX_DATE } from "@/lib/currency";
import { formatDate, paths, type Locale } from "@/lib/i18n";
import { filmThumb, filmUploadDate, type Film } from "@/lib/restaurants/films";
import { MIN_PRICED_DISHES } from "@/lib/restaurants/stats";
import {
  CHANNEL_URL,
  CONTACT_EMAIL,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  PUBLIC_REPO_URL,
  PUBLISHER_NAME,
  SITE_NAME,
  absoluteUrl,
} from "@/lib/site";
import { PRICE_SYMBOL_BANDS } from "@/lib/restaurants/meal-cost";

// About, methodology and films: who publishes Mesasays and how every fact is checked.

export type CatalogCounts = { restaurants: number; menus: number; prices: number; latestCheck: string | null };

const lang = (locale: Locale) => (locale === "es" ? "es-MX" : undefined);

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ms-box" style={{ marginBottom: 16 }}>
      <div className="ms-box-head"><span className="ms-label">{title}</span></div>
      <div className="ms-prose" style={{ padding: "10px 12px" }}>{children}</div>
    </section>
  );
}

const External = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="ms-link" target="_blank" rel="noreferrer">{children}</a>
);

export function AboutView({ counts, films, locale }: { counts: CatalogCounts; films: Film[]; locale: Locale }) {
  const es = locale === "es";
  const n = (value: number) => value.toLocaleString(es ? "es-MX" : "en-US");
  const page = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    url: absoluteUrl(paths.about(locale)),
    inLanguage: es ? "es-MX" : "en",
    about: {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      sameAs: [CHANNEL_URL, INSTAGRAM_URL],
      parentOrganization: { "@type": "Organization", name: PUBLISHER_NAME, sameAs: [CHANNEL_URL, INSTAGRAM_URL] },
    },
  };
  return (
    <main className="ms-page" lang={lang(locale)}>
      <JsonLd data={page} />
      <div className="ms-eyebrow"><span className="ms-label">{es ? "Quiénes somos" : "About"}</span></div>
      <h1 className="ms-title">{es ? `${SITE_NAME}, por ${PUBLISHER_NAME}` : `${SITE_NAME}, by ${PUBLISHER_NAME}`}</h1>
      <p className="ms-lede">
        {es
          ? `${SITE_NAME} es una guía de hechos sobre los restaurantes de la Ciudad de México: cuánto cuesta comer, cómo reservar, dónde están y qué hay en la carta, cada dato verificado en la fuente oficial y fechado. Hoy: ${n(counts.restaurants)} restaurantes, ${n(counts.menus)} cartas oficiales y ${n(counts.prices)} precios verificados.`
          : `${SITE_NAME} is a fact guide to Mexico City restaurants: what a meal costs, how to book, where they are and what is on the menu, every fact checked on the official source and dated. Today: ${n(counts.restaurants)} restaurants, ${n(counts.menus)} official menus and ${n(counts.prices)} checked prices.`}
      </p>

      <Panel title={es ? "Quién lo publica" : "Who publishes it"}>
        <p>
          {es
            ? `${SITE_NAME} lo publica ${PUBLISHER_NAME}, un canal independiente de documentales sobre restaurantes y la gente que los hace. Filmamos en cocinas de la Ciudad de México, Ciudad del Cabo, París y Nueva York.`
            : `${SITE_NAME} is published by ${PUBLISHER_NAME}, an independent channel of documentaries about restaurants and the people who run them. We film in kitchens in Mexico City, Cape Town, Paris and New York.`}
        </p>
        <p>
          YouTube: <External href={CHANNEL_URL}>@TheDiningDispatch</External> · Instagram:{" "}
          <External href={INSTAGRAM_URL}>{INSTAGRAM_HANDLE}</External> ·{" "}
          <Link href={paths.films(locale) as never} className="ms-link">
            {es ? `${films.length} películas en la Ciudad de México` : `${films.length} Mexico City films`}
          </Link>
        </p>
      </Panel>

      <Panel title={es ? "Independencia" : "Independence"}>
        <p>
          {es
            ? "Ningún restaurante paga por aparecer, por su posición ni por un video. No aceptamos patrocinios ni contenido pagado. No vendemos reservaciones ni cobramos comisión: los enlaces de reservación llevan al canal oficial de cada restaurante."
            : "No restaurant pays to be listed, ranked or filmed. We take no sponsorship or paid features. We do not sell bookings or take commissions: booking links go to each restaurant's own channel."}
        </p>
        <p>
          {es
            ? "No publicamos calificaciones, estrellas ni opiniones sin firmar. Solo hechos con fuente y fecha."
            : "We publish no ratings, stars or unsigned opinions. Only facts with a source and a date."}
        </p>
      </Panel>

      <Panel title={es ? "Correcciones" : "Corrections"}>
        <p>
          {es
            ? <>¿Un precio cambió, un restaurante cerró o un enlace está mal? Cada ficha tiene un enlace «Reportar un error». También puedes abrir un reporte en <External href={`${PUBLIC_REPO_URL}/issues`}>GitHub</External>, escribir a <a href={`mailto:${CONTACT_EMAIL}`} className="ms-link">{CONTACT_EMAIL}</a> o mandarnos un mensaje por Instagram a <External href={INSTAGRAM_URL}>{INSTAGRAM_HANDLE}</External>. Verificamos en la fuente oficial y la corrección aparece fechada en <Link href={paths.updates(locale) as never} className="ms-link">novedades</Link>.</>
            : <>A price changed, a restaurant closed or a link is wrong? Every restaurant page has a &ldquo;Report an error&rdquo; link. You can also open an issue on <External href={`${PUBLIC_REPO_URL}/issues`}>GitHub</External>, email <a href={`mailto:${CONTACT_EMAIL}`} className="ms-link">{CONTACT_EMAIL}</a> or message us on Instagram at <External href={INSTAGRAM_URL}>{INSTAGRAM_HANDLE}</External>. We check the official source and the fix appears, dated, in the <Link href={paths.updates(locale) as never} className="ms-link">change log</Link>.</>}
        </p>
      </Panel>

      <Panel title={es ? "Datos" : "Data"}>
        <p>
          {es ? "Todo el catálogo se puede consultar en " : "The whole catalog can be read as "}
          <a href="/data/restaurants.json" className="ms-link">JSON</a>
          {es ? ", solo como referencia (sin licencia de reutilización). " : ", for reference only (no reuse licence). "}
          {es ? "Cada restaurante tiene también una ficha en texto plano en /facts/<slug>.txt." : "Every restaurant also has a plain-text fact sheet at /facts/<slug>.txt."}{" "}
          <Link href={paths.methodology(locale) as never} className="ms-link">{es ? "Cómo verificamos" : "How we check"} <span aria-hidden="true">→</span></Link>
        </p>
        <p>
          {es
            ? <>El código del sitio es abierto: <External href={PUBLIC_REPO_URL}>AGPL-3.0</External>.</>
            : <>The site code is open source: <External href={PUBLIC_REPO_URL}>AGPL-3.0</External>.</>}
        </p>
        <p>
          <Link href={paths.privacy(locale) as never} className="ms-link">{es ? "Privacidad" : "Privacy"} <span aria-hidden="true">→</span></Link>
        </p>
        <p>
          {es
            ? "Dirección visual inspirada en deepstate.sh; todo el código fue escrito de forma independiente por MesaSays."
            : "Visual direction inspired by deepstate.sh; all code written independently by MesaSays."}
        </p>
      </Panel>
    </main>
  );
}

export function MethodologyView({ counts, locale }: { counts: CatalogCounts; locale: Locale }) {
  const es = locale === "es";
  const checked = formatDate(counts.latestCheck, locale);
  const bands = (loc: string) =>
    `$ ≤ ${PRICE_SYMBOL_BANDS[0]}, $$ ≤ ${PRICE_SYMBOL_BANDS[1]}, $$$ ≤ ${PRICE_SYMBOL_BANDS[2].toLocaleString(loc)}, $$$$ > ${PRICE_SYMBOL_BANDS[2].toLocaleString(loc)}`;
  const sections: Array<[string, string]> = es
    ? [
        ["Qué entra", "Solo si el sitio oficial (o el Instagram que enlaza) confirma la dirección, con carta oficial o Instagram verificado, y un contacto. Las listas de prensa sirven para descubrir, nunca como fuente. Bares y cafés sin carta: fuera."],
        ["Precios y fechas", "Solo de la carta del restaurante: sitio, PDF o página oficial de pedidos. Nunca apps de entrega, reseñas ni bases de terceros. Cada platillo: sección, precio en pesos tal cual, fecha. Menos de 15 pesos: descartado. Cada carta se revisa a los 30 días; vencida, sale de las estadísticas y la ficha lo dice."],
        ["Costo por persona y $", `Entrada mediana + plato fuerte mediano de la carta oficial. Si no: un plato fuerte, tres tacos, un desayuno o el menú fijo más barato. Sin bebidas, postres, guarniciones ni propina (10–15 %). Sin carta con precios, sin estimación. USD y EUR al tipo del BCE del ${FX_DATE}. Símbolos en pesos, de nuestro propio cálculo, nunca de Google: ${bands("es-MX")}.`],
        ["Índice de precios", `Mediana por restaurante desde ${MIN_PRICED_DISHES} platillos con precio; por colonia o cocina desde 3 restaurantes. Grupos: mediana de medianas.`],
        ["Reservación, Instagram, mapa", "Solo si el sitio oficial los da. Ubicación revisada contra la dirección verificada (OpenStreetMap)."],
        ["Lo que no hacemos", "No evadimos anti-robots ni CAPTCHAs: bloqueado = no publicado. No compramos datos ni adivinamos. Un cierre se retira y queda en novedades."],
      ]
    : [
        ["What gets in", "Only if the official site (or the Instagram it links) confirms the address, with an official menu or verified Instagram, and a contact. Press lists help us find places, never as a source. Bars and cafés without a menu: out."],
        ["Prices and dates", "Only the restaurant's own menu: website, PDF or official ordering page. Never delivery apps, reviews or third-party databases. Each dish: section, peso price as printed, date. Under 15 pesos: dropped. Every menu is re-checked after 30 days; overdue, it leaves the stats and the page says so."],
        ["Cost per person and $", `Median starter + median main from the official menu. Otherwise: one main, three tacos, one breakfast plate or the cheapest set menu. No drinks, desserts, sides or tip (10–15%). No priced menu, no estimate. USD and EUR at the ECB rate of ${FX_DATE}. Symbols in pesos, from our own estimate, never Google: ${bands("en-US")}.`],
        ["Price index", `A restaurant median needs ${MIN_PRICED_DISHES} priced dishes; a neighborhood or cuisine needs 3 such restaurants. Groups: median of medians.`],
        ["Booking, Instagram, map", "Only when the official site gives them. Map points checked against the verified address (OpenStreetMap)."],
        ["What we do not do", "No getting around bot protection or CAPTCHAs: blocked means unpublished. No bought data, no guessing. Closures are removed and logged."],
      ];
  return (
    <main className="ms-page" lang={lang(locale)}>
      <div className="ms-eyebrow">
        <span className="ms-label">{es ? "Metodología" : "Methodology"}</span>
        {checked ? <span className="ms-num">{es ? "última verificación" : "last check"} {checked}</span> : null}
      </div>
      <h1 className="ms-title">{es ? "Cómo verificamos cada restaurante" : "How every restaurant is checked"}</h1>
      <p className="ms-lede">
        {es
          ? `Cada dato tiene fuente oficial y fecha. Así se construyen las ${counts.restaurants} fichas.`
          : `Every fact has an official source and a date. How the ${counts.restaurants} records are built:`}
      </p>
      {sections.map(([title, text]) => (
        <Panel key={title} title={title}><p>{text}</p></Panel>
      ))}
      <p className="ms-num">
        <Link href={paths.about(locale) as never} className="ms-link">{es ? "Quiénes somos" : "About"}</Link> ·{" "}
        <Link href={paths.budget(locale) as never} className="ms-link">{es ? "Comer según tu presupuesto" : "Eat on a budget"}</Link> ·{" "}
        <Link href={paths.prices(locale) as never} className="ms-link">{es ? "Índice de precios" : "Price index"}</Link>
      </p>
    </main>
  );
}

export function FilmsView({
  films,
  names,
  locale,
}: {
  films: Film[];
  names: Record<string, string>;
  locale: Locale;
}) {
  const es = locale === "es";
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: es ? `Películas de ${PUBLISHER_NAME} en la Ciudad de México` : `${PUBLISHER_NAME} films in Mexico City`,
    itemListElement: films.map((film, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "VideoObject",
        name: film.title,
        description: film.summary,
        uploadDate: filmUploadDate(film),
        thumbnailUrl: absoluteUrl(filmThumb(film.videoId)),
        contentUrl: `https://www.youtube.com/watch?v=${film.videoId}`,
        about: { "@type": "Restaurant", name: names[film.restaurantSlug], url: absoluteUrl(paths.restaurant(film.restaurantSlug, locale)) },
      },
    })),
  };
  return (
    <main className="ms-page" lang={lang(locale)}>
      <JsonLd data={list} />
      <div className="ms-eyebrow">
        <span className="ms-label">{es ? "Películas" : "Films"}</span>
        <span className="ms-num">{films.length}</span>
      </div>
      <h1 className="ms-title">{es ? "Restaurantes de la Ciudad de México, filmados" : "Mexico City restaurants, filmed"}</h1>
      <p className="ms-lede">
        {es
          ? <>Documentales de {PUBLISHER_NAME}: un día en la cocina, del mercado al servicio. Cada película lleva a la ficha verificada del restaurante. Más en <External href={CHANNEL_URL}>YouTube</External> e <External href={INSTAGRAM_URL}>Instagram</External>.</>
          : <>Documentaries by {PUBLISHER_NAME}: a day in the kitchen, from the market to service. Each film links to the restaurant&apos;s checked record. More on <External href={CHANNEL_URL}>YouTube</External> and <External href={INSTAGRAM_URL}>Instagram</External>.</>}
      </p>
      <section className="ms-box">
        <ul className="ms-list">
          {films.map((film) => (
            <li key={film.videoId} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <a href={`https://www.youtube.com/watch?v=${film.videoId}`} target="_blank" rel="noreferrer" style={{ flex: "0 0 160px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={filmThumb(film.videoId, "mq")} alt={film.title} width={160} height={90} loading="lazy" style={{ display: "block", width: "100%", height: "auto" }} />
              </a>
              <div>
                <External href={`https://www.youtube.com/watch?v=${film.videoId}`}><strong>{film.title}</strong></External>
                <br />
                <span className="ms-num">{formatDate(film.publishedAt, locale)} · {Math.round(film.durationSeconds / 60)} min</span>
                <br />
                {film.summary}{" "}
                <Link href={paths.restaurant(film.restaurantSlug, locale) as never} className="ms-link">
                  {names[film.restaurantSlug] ?? film.restaurantSlug} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export const PRIVACY_UPDATED = "2026-11-01";

export function PrivacyView({ locale }: { locale: Locale }) {
  const es = locale === "es";
  const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="ms-link">{CONTACT_EMAIL}</a>;
  const github = <External href={`${PUBLIC_REPO_URL}/issues`}>GitHub</External>;
  return (
    <main className="ms-page" lang={lang(locale)}>
      <div className="ms-eyebrow">
        <span className="ms-label">{es ? "Privacidad" : "Privacy"}</span>
        <span className="ms-num">{es ? "actualizado" : "updated"} {formatDate(PRIVACY_UPDATED, locale)}</span>
      </div>
      <h1 className="ms-title">{es ? "Lo que guardamos sobre ti" : "What we keep about you"}</h1>

      <Panel title={es ? "Al visitar el sitio" : "When you visit"}>
        <p>
          {es
            ? "Sin analítica, sin cookies, sin scripts de rastreo. Al cargar una página, tu navegador no hace ninguna petición a Google ni a otros terceros: fuentes, imágenes y miniaturas se sirven desde este sitio."
            : "No analytics, no cookies, no tracking scripts. When a page loads, your browser makes no request to Google or any other third party: fonts, images and thumbnails are served from this site."}
        </p>
        <p>
          {es
            ? "El reproductor de YouTube (youtube-nocookie.com) solo se carga cuando presionas play en una película. Los enlaces a Instagram, OpenTable, sitios de restaurantes u OpenStreetMap son enlaces normales: nada se carga hasta que haces clic."
            : "The YouTube player (youtube-nocookie.com) loads only when you press play on a film. Links to Instagram, OpenTable, restaurant sites or OpenStreetMap are ordinary links: nothing loads until you click."}
        </p>
        <p>
          {es
            ? "La moneda que eliges queda en tu navegador (localStorage) y nunca sale de él; si publicaste en Say antes de su pausa, también el nombre que usaste. Puedes borrarlos limpiando los datos del sitio."
            : "The currency you pick stays in your browser (localStorage) and never leaves it; so does the name you used on Say, if you posted before it was paused. Clearing the site data removes them."}
        </p>
      </Panel>

      <Panel title="Say">
        <p>
          {es
            ? "Say está en pausa desde el 5 de noviembre de 2026: ya no se puede publicar. Lo que sigue describe las publicaciones anteriores."
            : "Say is paused since 5 November 2026: no new posts can be made. What follows covers earlier posts."}
        </p>
        <p>
          {es
            ? "Sin cuenta y sin correo. Cuando publicas, guardamos el nombre que eliges, tu texto, la hora y el restaurante al que se refiere. No guardamos tu dirección IP. Tu navegador no habla directamente con la base de datos: nuestro servidor le pasa la publicación."
            : "No account, no email. When you post, we store the name you choose, your text, the time and which restaurant it is about. We do not store your IP address. Your browser does not talk to the database directly: our server passes the post on."}
        </p>
        <p>
          {es
            ? "Las publicaciones son públicas y, desde el 31 de octubre de 2026, se comparten bajo CC BY-SA 4.0. La moderación puede ocultarlas."
            : "Posts are public and, since 31 October 2026, shared under CC BY-SA 4.0. Moderation can hide them."}
        </p>
        <p>
          {es
            ? <>Para pedir que retiremos una publicación tuya: abre un reporte en {github} o escribe a {mail}.</>
            : <>To ask us to remove a post of yours: open an issue on {github} or email {mail}.</>}
        </p>
      </Panel>

      <Panel title={es ? "Alojamiento" : "Hosting"}>
        <p>
          {es
            ? "El sitio lo aloja Vercel y las publicaciones anteriores de Say, Supabase. Como cualquier proveedor de alojamiento, Vercel ve la dirección IP de los visitantes en sus registros técnicos. No usamos esos registros para rastrear a nadie."
            : "The site is hosted by Vercel and earlier Say posts by Supabase. Like any host, Vercel sees visitors' IP addresses in its technical logs. We do not use those logs to track anyone."}
        </p>
      </Panel>

      <p className="ms-num">
        <Link href={paths.about(locale) as never} className="ms-link">{es ? "Quiénes somos" : "About"}</Link>
      </p>
    </main>
  );
}
