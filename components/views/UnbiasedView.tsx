import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { paths, type Locale } from "@/lib/i18n";
import { CONTACT_EMAIL, SITE_NAME, absoluteUrl } from "@/lib/site";

// /unbiased: the green word of the home title. The project and its values, in as few words as possible.
// Every claim here must stay true: if one stops being true, change the page the same day.

function Part({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section className="ms-manifesto-part">
      <p className="ms-manifesto-num ms-label">{num}</p>
      <div className="ms-manifesto-body">
        <h2 className="ms-manifesto-h">{title}</h2>
        {children}
      </div>
    </section>
  );
}

export function UnbiasedView({ locale }: { locale: Locale }) {
  const es = locale === "es";
  const t = es
    ? {
        eyebrow: "Nuestro proyecto",
        title: "Imparcial, y por qué",
        lede: "Construimos el asistente de restaurantes que lo sabe todo de la Ciudad de México, y que sirve igual a quien come y a quien cocina.",
        parts: [
          ["El proyecto", "Cada restaurante, con su carta real, sus precios, sus horarios y cómo reservar. Hoy en mesasays.com. Muy pronto dentro de ChatGPT y Claude."],
          ["Imparcial", "Ningún restaurante paga por aparecer, por su lugar ni por un video. Sin anuncios, sin resultados patrocinados, sin comisión. Un lugar aparece porque responde a lo que pediste."],
          ["Hechos, no opiniones", "Cada precio sale de la carta del propio restaurante, con la fecha en que lo verificamos. Una carta de más de un año se retira."],
          ["Tus datos son tuyos", "Sin cuenta. Sin cookies, sin analítica, sin rastreo."],
          ["También para los restaurantes", "Cada restaurante tiene la misma oportunidad que su vecino. Tener su ficha al día no le cuesta nada: nos manda su carta y la fechamos."],
        ],
        nextTitle: "Lo que sigue",
        next: ["Directo en ChatGPT y Claude.", "Reservar sin comisión.", "Opiniones de quienes de verdad comieron ahí."],
        motto: "Ningún restaurante paga por estar aquí.",
        contact: "¿Un restaurante, una corrección, una idea? Escríbenos a",
        privacy: "Privacidad",
        method: "Cómo verificamos",
      }
    : {
        eyebrow: "Our project",
        title: "Unbiased, and why",
        lede: "We are building the restaurant assistant that knows all of Mexico City, and serves diners and restaurants equally.",
        parts: [
          ["The project", "Every restaurant, with its real menu, prices, hours and how to book. Today on mesasays.com. Soon right inside ChatGPT and Claude."],
          ["Unbiased", "No restaurant pays to be listed, ranked or filmed. No ads, no sponsored results, no commission. A place shows up because it fits what you asked."],
          ["Facts, not opinions", "Every price comes from the restaurant's own menu, with the date we checked it. A menu older than a year is removed."],
          ["Your data stays yours", "No account. No cookies, no analytics, no tracking."],
          ["For restaurants too", "Every restaurant gets the same chance as its neighbour. Keeping its page right costs nothing: it sends us its menu, we date it."],
        ],
        nextTitle: "What comes next",
        next: ["Right inside ChatGPT and Claude.", "Booking without commission.", "Reviews from people who really ate there."],
        motto: "No restaurant pays to be here.",
        contact: "A restaurant, a correction, an idea? Write to",
        privacy: "Privacy",
        method: "How we check",
      };

  const page = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    url: absoluteUrl(paths.unbiased(locale)),
    inLanguage: es ? "es-MX" : "en",
    name: `${SITE_NAME}: ${t.title}`,
  };

  return (
    <main className="ms-page ms-manifesto" lang={es ? "es-MX" : undefined}>
      <JsonLd data={page} />
      <div className="ms-eyebrow"><span className="ms-label">{t.eyebrow}</span></div>

      <header className="ms-manifesto-head">
        <h1 className="ms-title">{t.title}</h1>
        <p className="ms-lede">{t.lede}</p>
      </header>

      {t.parts.map(([title, text], i) => (
        <Part key={title} num={String(i + 1).padStart(2, "0")} title={title}>
          <p>{text}</p>
          {i === 2 ? <p><Link href={paths.methodology(locale) as never} className="ms-link">{t.method}</Link></p> : null}
          {i === 3 ? <p><Link href={paths.privacy(locale) as never} className="ms-link">{t.privacy}</Link></p> : null}
        </Part>
      ))}

      <Part num={String(t.parts.length + 1).padStart(2, "0")} title={t.nextTitle}>
        <ol className="ms-manifesto-list is-ordered">
          {t.next.map((line) => <li key={line}>{line}</li>)}
        </ol>
      </Part>

      <footer className="ms-manifesto-end">
        <p className="ms-manifesto-motto">{t.motto}</p>
        <p className="ms-manifesto-contact">
          {t.contact} <a href={`mailto:${CONTACT_EMAIL}`} className="ms-link">{CONTACT_EMAIL}</a>.
        </p>
      </footer>
    </main>
  );
}
