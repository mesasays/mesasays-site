import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { FX_DATE } from "@/lib/currency";
import { OPEN_DATASET_URL, dataLicense } from "@/lib/data/license";
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

      <Panel title={es ? "Datos abiertos" : "Open data"}>
        <p>
          {es ? "Todo el catálogo se puede descargar en " : "The whole catalog can be downloaded as "}
          <a href="/data/restaurants.json" className="ms-link">JSON</a>
          {dataLicense.license
            ? es
              ? " bajo licencia ODbL 1.0 (cita a Mesasays). "
              : " under the ODbL 1.0 licence (credit Mesasays). "
            : es
              ? ", solo como referencia: mezcla datos de fuentes que no podemos volver a licenciar, así que este archivo no da permiso de reutilización. "
              : " for reference only: it mixes facts from sources we may not relicense, so this file comes with no reuse licence. "}
          {es ? "Cada restaurante tiene también una ficha en texto plano en /facts/<slug>.txt." : "Every restaurant also has a plain-text fact sheet at /facts/<slug>.txt."}{" "}
          <Link href={paths.methodology(locale) as never} className="ms-link">{es ? "Cómo verificamos" : "How we check"} <span aria-hidden="true">→</span></Link>
        </p>
        <p>
          {es
            ? <>Para reutilizar los datos, usa el <External href={OPEN_DATASET_URL}>conjunto de datos abierto</External> (ODbL 1.0, sin datos de Google). El código del sitio también es abierto: <External href={PUBLIC_REPO_URL}>AGPL-3.0</External>.</>
            : <>To reuse the data, take the <External href={OPEN_DATASET_URL}>open dataset</External> (ODbL 1.0, no Google data). The site code is open too: <External href={PUBLIC_REPO_URL}>AGPL-3.0</External>.</>}
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
  const sections: Array<[string, string]> = es
    ? [
        ["Qué entra al catálogo", "Un restaurante entra solo si su sitio oficial (o su Instagram oficial enlazado desde él) confirma la dirección, y si tiene una carta oficial o un Instagram verificado y un canal de contacto. Las listas de prensa (Time Out, The Infatuation, Chilango, Local.mx y otras) sirven para descubrir lugares; nunca son la fuente de un dato. Bares y cafés sin carta quedan fuera."],
        ["De dónde vienen los precios", "Solo de la carta propia del restaurante: su sitio web, su PDF o su página oficial de pedidos. No usamos precios de apps de entrega (suelen ser más altos), ni de reseñas, ni de bases de datos de terceros. Cada platillo se transcribe con su sección, su precio en pesos tal como aparece y la fecha de verificación. Se descartan precios menores a 15 pesos (suelen ser extras)."],
        ["Fechas y revisión", "Cada carta lleva la fecha en que se verificó y una fecha de revisión 30 días después. Una carta vencida sale de las estadísticas y del cálculo de costo por persona hasta que se vuelve a verificar; la ficha lo indica."],
        ["Costo por persona", `Estimado con la carta oficial: entrada mediana más plato fuerte mediano; un plato fuerte si no hay entradas; tres tacos en una taquería; un desayuno en un lugar de desayunos; o el menú fijo más económico en un restaurante de degustación. Sin bebidas, postres, guarniciones ni propina (10–15 % en México). Sin una carta con secciones y precios no hay estimación. Equivalentes en dólares y euros con el tipo de referencia del Banco Central Europeo del ${FX_DATE}.`],
        ["Símbolos $ a $$$$", `Calculados con nuestro costo por persona, nunca con Google ni con otra fuente externa: $ hasta ${PRICE_SYMBOL_BANDS[0]} pesos, $$ hasta ${PRICE_SYMBOL_BANDS[1]}, $$$ hasta ${PRICE_SYMBOL_BANDS[2].toLocaleString("es-MX")}, $$$$ más de ${PRICE_SYMBOL_BANDS[2].toLocaleString("es-MX")}. Sin estimación de costo no hay símbolo.`],
        ["Índice de precios", `Un restaurante necesita al menos ${MIN_PRICED_DISHES} platillos con precio para tener mediana; una colonia o tipo de cocina necesita al menos 3 restaurantes así. Las cifras de grupo son la mediana de las medianas.`],
        ["Reservaciones, Instagram y mapa", "El canal de reservación solo se publica si el sitio oficial lo enlaza o lo indica (OpenTable, Resy, WhatsApp, teléfono o sin reservación). El Instagram solo si el sitio oficial lo enlaza. La ubicación en el mapa se revisa contra la dirección verificada (OpenStreetMap)."],
        ["Lo que no hacemos", "No evadimos protecciones anti-robots ni CAPTCHAs: si una página bloquea la consulta, el dato no se publica. No usamos datos pagados ni inventamos lo que falta. Un restaurante cerrado se retira y el cierre queda registrado en novedades."],
      ]
    : [
        ["What gets into the catalog", "A restaurant is listed only when its official website (or the official Instagram linked from it) confirms the address, and it has an official menu or a verified Instagram plus a way to contact it. Press lists (Time Out, The Infatuation, Chilango, Local.mx and others) are used to discover places; they are never the source of a fact. Bars and cafés without a menu are left out."],
        ["Where prices come from", "Only from the restaurant's own menu: its website, its PDF or its official ordering page. We do not use delivery-app prices (usually marked up), reviews, or third-party databases. Each dish is transcribed with its section, its peso price as printed and the date it was checked. Prices under 15 pesos are dropped (usually add-ons)."],
        ["Dates and re-checks", "Every menu carries the date it was checked and a re-check date 30 days later. An overdue menu drops out of the statistics and the cost-per-person estimate until it is checked again; the restaurant page says so."],
        ["Cost per person", `Estimated from the official menu: the median starter plus the median main course; one main course when there is no starter section; three tacos at a taquería; one breakfast plate at a breakfast place; or the cheapest set menu at a tasting-menu restaurant. Drinks, desserts, sides and tip (10–15% in Mexico) are not included. No sectioned, priced menu means no estimate. Dollar and euro equivalents use the European Central Bank reference rate of ${FX_DATE}.`],
        ["$ to $$$$ symbols", `Worked out from our own cost per person, never from Google or another third party: $ up to ${PRICE_SYMBOL_BANDS[0]} pesos, $$ up to ${PRICE_SYMBOL_BANDS[1]}, $$$ up to ${PRICE_SYMBOL_BANDS[2].toLocaleString("en-US")}, $$$$ over ${PRICE_SYMBOL_BANDS[2].toLocaleString("en-US")}. No cost estimate, no symbol.`],
        ["Price index", `A restaurant needs at least ${MIN_PRICED_DISHES} priced dishes to get a median; a neighborhood or cuisine needs at least 3 such restaurants. Group figures are the median of restaurant medians.`],
        ["Booking, Instagram and map", "A booking channel is published only when the official site links or states it (OpenTable, Resy, WhatsApp, phone or walk-in). Instagram only when the official site links it. Map points are checked against the verified address (OpenStreetMap)."],
        ["What we do not do", "We do not get around bot protection or CAPTCHAs: if a page blocks the check, the fact is not published. We buy no data and fill no gaps by guessing. A closed restaurant is removed and the closure is logged in the change log."],
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
          ? `Cada dato de ${SITE_NAME} tiene una fuente oficial y una fecha. Así se construyen las ${counts.restaurants} fichas.`
          : `Every fact on ${SITE_NAME} has an official source and a date. This is how the ${counts.restaurants} records are built.`}
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
            ? "Dos datos quedan en tu navegador (localStorage): la moneda que eliges y el nombre que usas en Say. La moneda nunca sale de tu navegador; el nombre solo nos llega con una publicación. Puedes borrarlos limpiando los datos del sitio."
            : "Two things stay in your browser (localStorage): the currency you pick and the name you use on Say. The currency never leaves your browser; the name reaches us only with a post. Clearing the site data removes them."}
        </p>
      </Panel>

      <Panel title="Say">
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
            ? "El sitio lo aloja Vercel y la base de datos de Say, Supabase. Como cualquier proveedor de alojamiento, Vercel ve la dirección IP de los visitantes en sus registros técnicos. No usamos esos registros para rastrear a nadie."
            : "The site is hosted by Vercel and Say's database by Supabase. Like any host, Vercel sees visitors' IP addresses in its technical logs. We do not use those logs to track anyone."}
        </p>
      </Panel>

      <p className="ms-num">
        <Link href={paths.about(locale) as never} className="ms-link">{es ? "Quiénes somos" : "About"}</Link>
      </p>
    </main>
  );
}
