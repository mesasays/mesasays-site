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
    <div className="ms-fact">
      <span className="ms-label">{label}</span>
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
  // Two ways to book, side by side: the restaurant's direct line (free for it) and, when there is one,
  // the online channel it chose. We only state a fee where it is a known model (OpenTable bills per diner).
  const callPhone = !facts.booking?.walkIn ? facts.booking?.phone ?? restaurant.contact.phone ?? null : null;
  const viaWhatsApp = facts.booking?.label === "WhatsApp";
  const directHref = callPhone
    ? viaWhatsApp
      ? `https://wa.me/${callPhone.replace(/\D/g, "").replace(/^(?!52)/, "52")}`
      : `tel:${callPhone.replace(/[^+\d]/g, "")}`
    : null;
  // A WhatsApp or phone "link" is the direct line itself, not a second way to book.
  const onlineUrl = bookUrl && !/^(tel:|https:\/\/(wa\.me|api\.whatsapp\.com)\/)/.test(bookUrl) && facts.booking!.label !== "WhatsApp" ? bookUrl : null;
  const platform = onlineUrl ? facts.booking!.label : null;
  const isDm = platform === "Instagram DM";
  const isOwnSite = platform === "Official site" || platform === "Reservation";
  const es = locale === "es";
  const book = {
    direct: viaWhatsApp ? "WhatsApp" : es ? "Llamar" : "Call",
    free: es ? "Gratis para el restaurante" : "Free for the restaurant",
    online: isOwnSite ? (es ? "Reservar en su sitio" : "Book on their site") : isDm ? (es ? "Mensaje en Instagram" : "Message on Instagram") : es ? `Reservar en ${platform}` : `Book on ${platform}`,
    onlineNote:
      platform === "OpenTable"
        ? es ? "El restaurante le paga a OpenTable por cada comensal reservado" : "The restaurant pays OpenTable for each diner booked"
        : isOwnSite
          ? es ? "En el sitio del propio restaurante" : "On the restaurant's own site"
          : isDm
            ? es ? "Gratis para el restaurante" : "Free for the restaurant"
          : es ? "Servicio de reservas elegido por el restaurante" : "Booking service chosen by the restaurant",
  };
  const instagram = instagramHref(restaurant.contact.instagram);
  const igUrl = instagram && !(bookUrl && /instagram\.com/.test(bookUrl)) ? instagram : null;
  const hasAny = facts.meal || facts.price || facts.tastingMenus.length || facts.booking || facts.menu || igUrl;
  if (!hasAny) return null;

  return (
    <section className="ms-box ms-quick" aria-labelledby="quick-facts" style={{ marginBottom: 16 }}>
      <div className="ms-box-head">
        {/* The box needs no title on screen; the check date is the useful part. */}
        <span className="ms-label" id="quick-facts" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{s.quickAnswers}</span>
        {facts.menu ? (
          <span className="ms-label">
            {s.menuChecked} {date(facts.menu.checkedAt)}
            {facts.menu.overdue ? ` · ${s.recheckDue}` : ""}
          </span>
        ) : null}
      </div>

      {/* Short answers only; method, ranges and sources stay in the FAQ data and the /facts text files. */}
      {facts.meal ? (
        <Fact label={s.mealForOne}>
          <strong className="ms-meal-price">≈ {pesos(facts.meal.estimate)}</strong>
          <span className="ms-num"> {foreignEquivalent(facts.meal.estimate)} · {mealExtrasNote(locale)}</span>
          {/* Budget left the main menu: each record points to its price band instead. */}
          <span className="ms-fact-link ms-num">
            {" "}
            <Link prefetch={false} href={budgetPath(locale, bandFor(facts.meal.estimate)) as never} className="ms-link">
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
          <strong>{pesos(menu.price)}</strong> <span className="ms-num">· {menu.name}</span>
        </Fact>
      ))}

      {/* Booking appears as a line only when no button can carry it (walk-in, channel without link). */}
      {facts.booking && !bookUrl && !callPhone ? (
        <Fact label={s.howToBook}>{facts.booking.walkIn ? s.walkIn : channel(facts.booking.label)}</Fact>
      ) : null}

      {directHref || onlineUrl ? (
        <div className="ms-book" aria-label={s.howToBook}>
          {directHref ? (
            <div className="ms-book-option">
              <a href={directHref} className="ms-button ms-button-book" rel="noreferrer" target={viaWhatsApp ? "_blank" : undefined}>
                {book.direct}
              </a>
              <span className="ms-book-note">{book.free}</span>
            </div>
          ) : null}
          {onlineUrl ? (
            <div className="ms-book-option">
              <a href={onlineUrl} className={directHref ? "ms-button" : "ms-button ms-button-book"} rel="noreferrer" target="_blank">
                {book.online}
              </a>
              <span className="ms-book-note">{book.onlineNote}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {facts.menu || igUrl ? (
        <div className="ms-actions">
          {facts.menu ? <a href="#menu" className="ms-button">{s.menu}</a> : null}
          {igUrl ? (
            <a href={igUrl} className="ms-button ms-button-ig" rel="noreferrer" target="_blank">Instagram</a>
          ) : null}
        </div>
      ) : null}

    </section>
  );
}
