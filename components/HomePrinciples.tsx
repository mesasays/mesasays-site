import Link from "next/link";
import { paths, type Locale } from "@/lib/i18n";

// Home, desktop only: the three promises under the hero, one per column. Hidden on phones (CSS),
// where the page goes straight to the finder.
export function HomePrinciples({ locale }: { locale: Locale }) {
  const es = locale === "es";
  const items: Array<{ num: string; title: string; text: string; href?: string; link?: string }> = es
    ? [
        { num: "01", title: "Cartas", text: "Precios de la carta de cada restaurante. Con fecha.", href: paths.methodology(locale), link: "Cómo verificamos" },
        { num: "02", title: "Justo", text: "Ningún restaurante paga. Sin comisiones.", href: paths.unbiased(locale), link: "Nuestros valores" },
        { num: "03", title: "Fácil", text: "Muy pronto directo en ChatGPT y Claude. Preguntas, y la respuesta ya es la buena." },
      ]
    : [
        { num: "01", title: "Menus", text: "Prices from each restaurant's own menu. Dated.", href: paths.methodology(locale), link: "How we check" },
        { num: "02", title: "Fair", text: "No restaurant pays. No commission.", href: paths.unbiased(locale), link: "Our values" },
        { num: "03", title: "Easy", text: "Soon right inside ChatGPT and Claude. You ask, the answer is already right." },
      ];

  return (
    <section className="ms-home-principles" aria-label={es ? "Nuestros principios" : "Our principles"}>
      {items.map((item) => (
        <div key={item.num} className="ms-home-principle">
          <p className="ms-label">{item.num} · {item.title}</p>
          <p className="ms-home-principle-text">{item.text}</p>
          {item.href ? (
            <Link href={item.href as never} className="ms-home-principle-link">
              {item.link} <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      ))}
    </section>
  );
}
