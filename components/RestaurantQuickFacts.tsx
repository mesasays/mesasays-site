import Link from "next/link";
import type { ReactNode } from "react";
import { foreignEquivalent } from "@/lib/currency";
import { formatDate, t, type Locale } from "@/lib/i18n";
import { bandFor, budgetPath, type BudgetBand } from "@/lib/restaurants/budget";
import { formatObserved, instagramHref } from "@/lib/restaurants/format";
import { mealExtrasNote, quickFacts } from "@/lib/restaurants/quick-facts";
import { pesos } from "@/lib/restaurants/stats";
import type { SiteRestaurant } from "@/lib/restaurants/types";

function bandLinkText(band: BudgetBand, locale: Locale) {
  if (band.max !== null) return locale === "es" ? `Más lugares por menos de ${band.max} MXN` : `More places under ${band.max} MXN`;
  return locale === "es" ? `Más lugares de más de ${band.min} MXN` : `More places over ${band.min} MXN`;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ds-row">
      <span className="ds-label">{label}</span>
      <span>{children}</span>
    </div>
  );
}

export function RestaurantQuickFacts({
  restaurant,
  locale = "en",
}: {
  restaurant: SiteRestaurant;
  locale?: Locale;
}) {
  const s = t(locale);
  const facts = quickFacts(restaurant);
  const ES_CHANNELS: Record<string, string> = { Phone: "Teléfono", "Official site": "Sitio oficial", "Walk-in": "Sin reservación", Reservation: "Reservación" };
  const channel = (label: string) => (locale === "es" ? ES_CHANNELS[label] ?? label : label);
  const date = (value: string | null | undefined) => (locale === "en" ? formatObserved(value) : formatDate(value, locale));
  const bookUrl = facts.booking?.url && !facts.booking.walkIn ? facts.booking.url : null;
  // Phone-only booking gets a call button (tel: link) in the same place as "Book".
  const callPhone = !bookUrl && !facts.booking?.walkIn ? facts.booking?.phone ?? restaurant.contact.phone ?? null : null;
  const instagram = instagramHref(restaurant.contact.instagram);
  const igUrl = instagram && !(bookUrl && /instagram\.com/.test(bookUrl)) ? instagram : null;
  const hasAny = facts.meal || facts.price || facts.tastingMenus.length || facts.booking || facts.menu || igUrl;
  if (!hasAny) return null;

  return (
    <section className="ds-panel ds-quick" aria-labelledby="quick-facts" style={{ marginBottom: 16 }}>
      <div className="ds-panel-head">
        {/* The box needs no title on screen; the check date is the useful part. */}
        <span className="ds-label" id="quick-facts" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{s.quickAnswers}</span>
        {facts.menu ? (
          <span className="ds-label">
            {s.menuChecked} {date(facts.menu.checkedAt)}
            {facts.menu.overdue ? ` · ${s.recheckDue}` : ""}
          </span>
        ) : null}
      </div>

      {/* Short answers only; method, ranges and sources stay in the FAQ data and the /facts text files. */}
      {facts.meal ? (
        <Fact label={s.mealForOne}>
          <strong className="ds-key-price">≈ {pesos(facts.meal.estimate)}</strong>
          <span className="num"> {foreignEquivalent(facts.meal.estimate)} · {mealExtrasNote(locale)}</span>
          {/* Budget left the main menu: each record points to its price band instead. */}
          <span className="ds-fact-link num">
            {" "}
            <Link prefetch={false} href={budgetPath(locale, bandFor(facts.meal.estimate)) as never} className="ds-link">
              {bandLinkText(bandFor(facts.meal.estimate), locale)} <span aria-hidden="true">→</span>
            </Link>
          </span>
        </Fact>
      ) : null}

      {facts.price ? (
        <Fact label={s.typicalDish}>
          <strong>{pesos(facts.price.median)}</strong>
        </Fact>
      ) : null}

      {facts.tastingMenus.map((menu) => (
        <Fact key={menu.name} label={s.setMenu}>
          <strong>{pesos(menu.price)}</strong> <span className="num">· {menu.name}</span>
        </Fact>
      ))}

      {/* Booking appears as a line only when no button can carry it (walk-in, channel without link). */}
      {facts.booking && !bookUrl && !callPhone ? (
        <Fact label={s.howToBook}>{facts.booking.walkIn ? s.walkIn : channel(facts.booking.label)}</Fact>
      ) : null}

      {facts.menu || bookUrl || callPhone || igUrl ? (
        <div className="ds-card-actions">
          {facts.menu ? <a href="#menu" className="ds-cta">{s.menu}</a> : null}
          {bookUrl ? (
            <a href={bookUrl} className="ds-cta ds-cta-book" rel="noreferrer" target="_blank">
              Booking
            </a>
          ) : null}
          {callPhone ? (
            <a href={`tel:${callPhone.replace(/[^+\d]/g, "")}`} className="ds-cta ds-cta-book">
              {locale === "es" ? "Llamar" : "Call"}
            </a>
          ) : null}
          {igUrl ? (
            <a href={igUrl} className="ds-cta ds-cta-ig" rel="noreferrer" target="_blank">Instagram</a>
          ) : null}
        </div>
      ) : null}

    </section>
  );
}
